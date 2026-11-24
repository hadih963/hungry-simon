/*
 * Hungry Simon: ESP32 rhythm instrument firmware
 * Project Group 9 · ACS_1C 2026/2027 · The Hague University of Applied Sciences
 *
 * Board:     DOIT ESP32 DevKit V1 (ESP32-WROOM-32, 4 MB flash)       parts: docs/components.md
 * Core:      Arduino-ESP32 3.x (includes ESP_I2S and LittleFS)
 * Libraries: TFT_eSPI (use firmware/User_Setup_HungrySimon.h), Adafruit NeoPixel, ESP32Servo,
 *            PubSubClient, ArduinoJson 7, STM32duino VL53L7CX
 *
 * The sketch is split into tabs; Arduino joins them in this order:
 *   hungry_simon.ino  pins, types, setup(), loop()
 *   audio.ino         MAX98357A over I2S: recorded clips from flash + synthesised notes
 *   cloud.ino         Wi-Fi + MQTT over TLS
 *   display.ino       falling notes on the 2.8" ILI9341 (320x240)
 *   game.ino          free play / Simon says / song challenge / pet mode
 *   keys.ino          8 lever-microswitch keys + the BOOT button, debouncing
 *   outputs.ino       9 WS2812 LED sticks, treat offer, MG90S servo
 *   sensors.ino       PIR presence, VL53L7CX hand sensor, IR treat sensors, battery, deep sleep
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
#include <vl53l7cx_class.h>   // STM32duino VL53L7CX library (8x8 multizone time of flight)
#include <ESP_I2S.h>          // I2S audio output (Arduino-ESP32 3.x)
#include <LittleFS.h>         // sound clips stored in flash
#include "secrets.h"          // copy secrets.h.example → secrets.h and fill in (never commit it)

// ---------------------------------------------------------------- pins (match src/learn/hardware.js)
// Every usable GPIO of the DevKit V1 is assigned: see docs/components.md "Pin budget".
const uint8_t KEY_PINS[8] = {13, 14, 27, 32, 33, 15, 2, 12};   // Do .. Do'  (lever microswitches to GND)
// GPIO 2, 12 and 15 are boot-strapping pins: fine for keys that only pull to GND (no external pull-ups!)
#define PIN_LEDS        16   // WS2812 data for all 9 sticks (through a 74AHCT125 + 330 Ω)
#define PIN_SERVO       17   // MG90S treat wheel
#define PIN_I2S_BCLK    26   // MAX98357A bit clock
#define PIN_I2S_LRC     25   // MAX98357A left/right (word) clock
#define PIN_I2S_DOUT    22   // MAX98357A data in
#define PIN_I2C_SDA     21   // VL53L7CX hand sensor under the chute
#define PIN_I2C_SCL     19
#define PIN_PIR         36   // HC-SR501, RTC pin → can wake the ESP32 from deep sleep
#define PIN_IR_LEVEL    39   // IR module across the reservoir: HIGH = no treats at the low mark
#define PIN_IR_DROP     35   // IR module at the chute: LOW pulse = a treat passed
#define PIN_BATTERY     34   // 2S pack through a 100k/33k divider
#define PIN_BTN_MODE     0   // BOOT button on the DevKit: short press = mode, long press = difficulty
// The ILI9341 display uses SCK 18, MOSI 23, CS 5, DC 4 (set in User_Setup_HungrySimon.h).

#define LEDS_PER_STICK   8
#define NUM_STICKS       9   // 8 keys + 1 chute stick (the 10th stick is a spare)
#define NUM_LEDS        (LEDS_PER_STICK * NUM_STICKS)   // 72
#define STICK_TREAT      8   // the chute stick = the treat light

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
float batteryV = 7.4f;            // 2S pack volts, measured every 10 s
volatile bool dropSeen = false;   // set by the IR drop interrupt
uint16_t tofMm = 0;               // nearest distance in the chute zones of the 8x8 grid, in mm
bool handPresent = false;         // a hand (or a snout) is under the chute

// treat offer: after a win the treat waits until a hand is held under the chute
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

  keysBegin();      // INPUT_PULLUP on the 8 keys and the BOOT button
  ledsBegin();      // 9 WS2812 sticks, all off
  soundBegin();     // I2S to the MAX98357A + audio task, sound clips from LittleFS
  displayBegin();   // ILI9341 + an off-screen sprite (frame buffer)
  servoBegin();     // MG90S to its rest angle
  sensorsBegin();   // PIR, IR level, IR drop (interrupt), battery ADC, VL53L7CX over I2C
  cloudBegin();     // starts Wi-Fi + MQTT over TLS in the background            //@setup.cloud

  lastActivityMs = millis();
  gameStart(mode);                                                                 //@setup.game
}

// ================================================================= loop(): runs forever, thousands of times per second
// Nothing in here may wait (no delay()), otherwise a key press could be missed.
void loop() {                                                                      //@loop
  uint32_t now = millis();

  keysScan(now);      // read + debounce keys → onKeyDown() / onKeyUp()          //@loop.keys
  buttonsScan(now);   // BOOT button: short = mode, long = difficulty            //@loop.buttons
  sensorsPoll(now);   // presence, hand under the chute, treat level, battery    //@loop.sensors
  gameTick(now);      // Simon playback, count-in, missed notes                  //@loop.game
  outputsTick(now);   // treat offer + servo steps (sound runs in its own task)  //@loop.outputs
  ledsShow(now);      // push LED colours to the strip if anything changed       //@loop.leds
  // the screen redraws itself 25× a second in its own task (display.ino)    //@loop.display
  cloudLoop(now);     // keep MQTT alive, receive commands                       //@loop.cloud
  sleepCheck(now);    // nobody around for a while → deep sleep                  //@loop.sleep
}
