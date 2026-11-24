/*
 * Hungry Simon: ESP32 rhythm instrument firmware
 * Project Group 9 · ACS_1C 2026/2027 · The Hague University of Applied Sciences
 *
 * Board:     LilyGO T-Display ESP32 (240x135 ST7789 TFT built in)
 * Core:      Arduino-ESP32 3.x
 * Libraries: TFT_eSPI (select Setup25_TTGO_T_Display), Adafruit NeoPixel, ESP32Servo,
 *            PubSubClient, ArduinoJson 7, VL53L1X (by Pololu)
 *
 * The sketch is split into tabs; Arduino joins them in this order:
 *   hungry_simon.ino  pins, types, setup(), loop()
 *   cloud.ino         Wi-Fi + MQTT over TLS
 *   display.ino       falling-notes screen
 *   game.ino          free play / Simon says / song challenge / pet mode
 *   keys.ino          8 keys + 2 buttons, debouncing
 *   outputs.ino       speaker, RGB LEDs, treat servo
 *   sensors.ino       PIR presence, ToF hand sensor, IR treat sensors, battery, deep sleep
 *
 * Lines ending in //@name are highlighted by the browser simulator when that step runs.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <VL53L1X.h>      // Pololu VL53L1X library (TOF400C-VL53L1X module)
#include "secrets.h"   // copy secrets.h.example → secrets.h and fill in (never commit it)

// ---------------------------------------------------------------- pins (match src/learn/hardware.js)
const uint8_t KEY_PINS[8] = {13, 15, 17, 2, 12, 25, 36, 37};   // Do .. Do'; 36/37 need external 10k pull-ups
// GPIO 2 and 12 are boot-strapping pins: fine for keys that only pull to GND (no external pull-up!)
#define PIN_SPEAKER     26   // LEDC PWM → PAM8302 amplifier
#define PIN_LEDS        27   // WS2812B data (through a 74AHCT125 level shifter)
#define PIN_SERVO       32   // SG90 treat wheel
#define PIN_PIR         33   // HC-SR501, RTC pin → can wake the ESP32 from deep sleep
#define PIN_IR_LEVEL    39   // IR module across the reservoir: HIGH = no treats at the low mark
#define PIN_IR_DROP     38   // IR module at the slide: LOW pulse = a treat passed
#define PIN_BATTERY     34   // battery divider on the T-Display (×2)
#define PIN_BTN_MODE     0   // built-in button
#define PIN_BTN_OPTION  35   // built-in button
#define PIN_I2C_SDA     21   // I2C bus: TOF400C-VL53L1X distance sensor under the treat outlet
#define PIN_I2C_SCL     22
#define NUM_LEDS         9   // 8 key LEDs + 1 treat light at the outlet, all on PIN_LEDS
#define LED_TREAT        8   // index of the treat light in the LED chain

// ---------------------------------------------------------------- music
const uint16_t NOTE_HZ[8]    = {262, 294, 330, 349, 392, 440, 494, 523};
const char*    NOTE_NAMES[8] = {"Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Do'"};
const uint32_t KEY_COLORS[8] = {0xFF4D4D, 0xFF9F1C, 0xFFD60A, 0x3DDC84, 0x2EC4B6, 0x3A86FF, 0x8338EC, 0xFF5FA2};
const uint8_t  PET_KEYS[4]   = {0, 2, 4, 6};   // pet mode: pairs of keys act as one big key

// ---------------------------------------------------------------- game types
enum Mode : uint8_t { MODE_FREE, MODE_SIMON, MODE_SONG, MODE_PET };
const char* MODE_NAMES[] = {"free", "simon", "song", "pet"};

enum State : uint8_t { ST_IDLE, ST_READY, ST_WATCH, ST_INPUT, ST_COUNTIN, ST_PLAY, ST_FAIL, ST_WON };

enum Difficulty : uint8_t { EASY, NORMAL, HARD };
struct DifficultyCfg { float tempo; uint16_t windowMs; uint8_t simonStart, simonGoal; uint16_t gapMs; };
const DifficultyCfg DIFF[3] = {
  // tempo  window  simon start/goal  gap between shown notes
  {  0.8f,  240,    2, 5,             700 },   // easy
  {  1.0f,  160,    3, 7,             560 },   // normal
  {  1.2f,  100,    4, 9,             440 },   // hard
};

// Types used by several tabs live here: Arduino joins the tabs in alphabetical order and puts
// its auto-generated function prototypes near the top, so they must be declared first.
struct Note  { uint8_t key; uint8_t halfBeats; };                       // length in half beats
struct Song  { const char* id; const char* title; uint8_t bpm; const Note* notes; uint8_t len; };
struct Beep  { uint16_t hz; uint16_t ms; };                             // one step of a sound effect
struct Debounce {
  bool stable;          // the accepted level
  bool lastRead;        // the most recent raw reading
  uint32_t changedAt;   // when the raw reading last changed
};

struct Settings {             // changed by the buttons or by the web app (cmd/settings)
  Difficulty difficulty = NORMAL;
  uint8_t volume = 70;        // 0..100 %
  uint8_t dailyTreatLimit = 5;
  uint8_t songIndex = 0;
};

// ---------------------------------------------------------------- shared state
Settings settings;
Mode mode = MODE_FREE;
bool keyHeld[8] = {false};
char player[16] = "Player 1";
uint32_t lastActivityMs = 0;

// game state (written by game.ino, read by display.ino and outputs.ino)
State    state = ST_IDLE;
uint8_t  seq[32];                 // Simon sequence
uint8_t  seqLen = 0, seqPos = 0, goal = 0, wins = 0;
int8_t   litKey = -1;             // key Simon is showing right now (-1 = none)
uint32_t score = 0;
const Song* song = nullptr;       // song challenge
uint16_t noteIdx = 0;             // next note to play
uint32_t songStartMs = 0;         // millis() at which note 0 should be played
uint32_t noteTimeMs[64];          // when each note should be played, relative to songStartMs

// sensor state (written by sensors.ino)
bool presence = false;
bool treatLevelLow = false;
float batteryV = 4.0f;            // volts, measured every 10 s
volatile bool dropSeen = false;   // set by the IR drop interrupt
uint16_t tofMm = 0;               // last ToF distance under the outlet, in mm
bool handPresent = false;         // a hand (or a snout) is under the outlet

// treat offer: after a win the treat waits until a hand is held under the outlet
bool offerPending = false;
uint32_t offerSince = 0;
const uint32_t OFFER_TIMEOUT_MS = 60000;

// treat dispenser steps (outputs.ino)
enum DispenseStep : uint8_t { DS_IDLE, DS_TURN, DS_WAIT_DROP };
DispenseStep ds = DS_IDLE;
uint32_t dsAt = 0;

const uint32_t SLEEP_AFTER_MS = 25000;   // no presence and no key for 25 s → deep sleep
const uint16_t FALL_MS = 2000;           // a note takes 2 s to fall to the hit line

// RTC memory keeps its value through deep sleep (normal RAM is wiped)
RTC_DATA_ATTR uint8_t  treatsToday = 0;
RTC_DATA_ATTR int16_t  treatDay = -1;
RTC_DATA_ATTR uint32_t gamesPlayed = 0;

// ================================================================= setup(): runs once after power-on or wake-up
void setup() {                                                                     //@setup
  Serial.begin(115200);
  Serial.println("[boot] Hungry Simon firmware v0.1");
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    Serial.println("[boot] woken from deep sleep by the PIR sensor (ext0)");      //@setup.wake
  }

  keysBegin();      // INPUT_PULLUP on the 8 keys and 2 buttons
  ledsBegin();      // WS2812B strip, all off
  soundBegin();     // LEDC PWM on the speaker pin
  displayBegin();   // TFT + an off-screen sprite (frame buffer)
  servoBegin();     // SG90 to its rest angle
  sensorsBegin();   // PIR, IR level, IR drop (interrupt), battery ADC, ToF over I2C
  cloudBegin();     // starts Wi-Fi + MQTT over TLS in the background            //@setup.cloud

  lastActivityMs = millis();
  gameStart(mode);                                                                 //@setup.game
}

// ================================================================= loop(): runs forever, thousands of times per second
// Nothing in here may wait (no delay()), otherwise a key press could be missed.
void loop() {                                                                      //@loop
  uint32_t now = millis();

  keysScan(now);      // read + debounce keys → onKeyDown() / onKeyUp()          //@loop.keys
  buttonsScan(now);   // mode / difficulty buttons                                //@loop.buttons
  sensorsPoll(now);   // presence, treat level, treat drop, battery              //@loop.sensors
  gameTick(now);      // Simon playback, count-in, missed notes                  //@loop.game
  outputsTick(now);   // end timed notes, sound effects, servo steps             //@loop.outputs
  ledsShow(now);      // push LED colours to the strip if anything changed       //@loop.leds
  displayDraw(now);   // redraw the screen every 40 ms (25 Hz)                   //@loop.display
  cloudLoop(now);     // keep MQTT alive, receive commands                       //@loop.cloud
  sleepCheck(now);    // nobody around for a while → deep sleep                  //@loop.sleep
}
