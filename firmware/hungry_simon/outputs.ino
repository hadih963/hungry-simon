// ================================================================= outputs.ino: speaker, RGB LEDs, treat servo

// ---------------------------------------------------------------- sound
// The LEDC peripheral makes a square wave at the note's frequency on its own; the CPU is free.
// Volume = duty cycle (50 % is the loudest a square wave gets).

int8_t   soundingKey = -1;
uint32_t toneEndsAt = 0;        // 0 = sustain until released
Beep     fx[8];                 // current sound effect
uint8_t  fxLen = 0, fxPos = 0;
uint32_t fxNextAt = 0;

const Beep FX_SUCCESS[] = {{523, 70}, {659, 70}, {784, 120}};
const Beep FX_WIN[]     = {{523, 110}, {659, 110}, {784, 110}, {1047, 110}, {784, 110}, {1047, 260}};
const Beep FX_ERROR[]   = {{185, 200}, {139, 350}};

void soundBegin() {
  ledcAttach(PIN_SPEAKER, 2000, 8);   // pin, start frequency, 8-bit duty resolution
  ledcWrite(PIN_SPEAKER, 0);          // silent
}

uint8_t volumeDuty() { return map(settings.volume, 0, 100, 0, 128); }

void soundNoteOn(int k) {
  fxLen = 0;                                          // a key press interrupts any effect
  ledcWriteTone(PIN_SPEAKER, NOTE_HZ[k]);             // e.g. Do = 262 Hz                    //@sound.on
  ledcWrite(PIN_SPEAKER, volumeDuty());
  soundingKey = k;
  toneEndsAt = 0;
}

void soundNoteOff(int k) {
  if (soundingKey != k) return;
  ledcWrite(PIN_SPEAKER, 0);                          // duty 0 = silence                    //@sound.off
  soundingKey = -1;
}

void soundNote(int k, uint16_t ms) {                  // fixed-length note (Simon showing)
  soundNoteOn(k);
  toneEndsAt = millis() + ms;                                                                //@sound.note
}

void soundPlayFx(const Beep* steps, uint8_t n) {      // played step by step from outputsTick()
  memcpy(fx, steps, n * sizeof(Beep));                                                       //@sound.fx
  fxLen = n; fxPos = 0; fxNextAt = 0;
}
void soundSuccess()        { soundPlayFx(FX_SUCCESS, 3); }
void soundWin()            { soundPlayFx(FX_WIN, 6); }
void soundError()          { soundPlayFx(FX_ERROR, 2); }
void soundTickFx(bool hi)  { Beep b = {(uint16_t)(hi ? 1568 : 1047), 35}; soundPlayFx(&b, 1); }

// ---------------------------------------------------------------- RGB LEDs (8 × WS2812B on one data pin)
Adafruit_NeoPixel strip(8, PIN_LEDS, NEO_GRB + NEO_KHZ800);
uint32_t ledShown[8];
uint32_t flashColor = 0, flashUntil = 0;

void ledsBegin() {
  strip.begin();
  strip.setBrightness(160);     // limits current: 8 LEDs × 60 mA would be too much for the battery
  strip.clear();
  strip.show();
}

void ledsFlash(uint32_t color, uint16_t ms) {        // all LEDs one colour: success / error
  flashColor = color;                                                                        //@leds.flash
  flashUntil = millis() + ms;
}

void ledsOff() { strip.clear(); strip.show(); }

uint32_t dimColor(uint32_t c, float f) {
  return ((uint32_t)(((c >> 16) & 0xFF) * f) << 16) | ((uint32_t)(((c >> 8) & 0xFF) * f) << 8) | (uint32_t)((c & 0xFF) * f);
}

void ledsShow(uint32_t now) {
  bool changed = false;
  for (int i = 0; i < 8; i++) {
    int k = (mode == MODE_PET) ? i - (i % 2) : i;     // pet mode: both LEDs of a pair together
    uint32_t c;
    if (now < flashUntil)  c = flashColor;
    else if (keyHeld[k])   c = KEY_COLORS[k];         // a held key glows in its own colour   //@leds.held
    else                   c = gameLedFor(k, now);    // next note / Simon showing / off
    if (c != ledShown[i]) {
      ledShown[i] = c;
      strip.setPixelColor(i, c);
      changed = true;
    }
  }
  if (changed) strip.show();                          // ~240 µs to clock 8 × 24 bits out    //@leds.show
}

// ---------------------------------------------------------------- treat dispenser (SG90 servo)
// A 50 Hz pulse of 0.5..2.4 ms sets the angle. Turning the paddle wheel 90° drops one treat.
Servo wheel;
const int SERVO_REST = 0, SERVO_DROP = 90;
enum DispenseStep : uint8_t { DS_IDLE, DS_TURN, DS_WAIT_DROP };
DispenseStep ds = DS_IDLE;
uint32_t dsAt = 0;

void servoBegin() {
  wheel.setPeriodHertz(50);
  wheel.attach(PIN_SERVO, 500, 2400);
  wheel.write(SERVO_REST);
}

bool treatDispense(const char* reason) {
  if (treatsToday >= settings.dailyTreatLimit) {                                            //@treat.limit
    Serial.printf("[treat] blocked: daily limit %d reached\n", settings.dailyTreatLimit);
    cloudPublish("treat/blocked", "{\"reason\":\"daily_limit\"}");
    return false;
  }
  if (ds != DS_IDLE) return false;                    // already dispensing
  Serial.printf("[treat] dispensing (%s)\n", reason);
  dropSeen = false;
  wheel.write(SERVO_DROP);                            // turn the wheel: one treat falls       //@servo.dispense
  ds = DS_TURN;
  dsAt = millis();
  return true;
}

void servoTick(uint32_t now) {
  switch (ds) {
    case DS_TURN:
      if (now - dsAt > 350) {                         // wheel has turned: go back
        wheel.write(SERVO_REST);                                                             //@servo.back
        ds = DS_WAIT_DROP;
        dsAt = now;
      }
      break;
    case DS_WAIT_DROP:
      if (dropSeen) {                                 // the IR sensor at the slide saw it fall
        treatsToday++;
        Serial.printf("[treat] drop confirmed by IR, %d today\n", treatsToday);              //@treat.confirmed
        char json[64];
        snprintf(json, sizeof json, "{\"today\":%d,\"confirmed\":true}", treatsToday);
        cloudPublish("treat/dispensed", json);
        ds = DS_IDLE;
      } else if (now - dsAt > 1500) {                 // nothing fell: empty or jammed
        Serial.println("[treat] no drop seen: reservoir empty or jammed");                  //@treat.nodrop
        cloudPublish("alert/treat_empty", "{\"confirmed\":false}");
        ds = DS_IDLE;
      }
      break;
    default: break;
  }
}

// Everything that has to happen "later": called every loop()
void outputsTick(uint32_t now) {
  if (toneEndsAt && now >= toneEndsAt) {              // end of a timed note
    ledcWrite(PIN_SPEAKER, 0);
    soundingKey = -1;
    toneEndsAt = 0;
  }
  if (fxPos < fxLen && now >= fxNextAt) {             // next step of a sound effect
    ledcWriteTone(PIN_SPEAKER, fx[fxPos].hz);
    ledcWrite(PIN_SPEAKER, volumeDuty());
    fxNextAt = now + fx[fxPos].ms;
    if (++fxPos == fxLen) toneEndsAt = fxNextAt;
  }
  servoTick(now);
}
