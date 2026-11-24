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

// ---------------------------------------------------------------- RGB LEDs (9 × WS2812B on one data pin)
// LEDs 0..7 sit under the keys; LED 8 is the treat light at the dispenser outlet (same data chain).
Adafruit_NeoPixel strip(NUM_LEDS, PIN_LEDS, NEO_GRB + NEO_KHZ800);
uint32_t ledShown[NUM_LEDS];
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
  uint32_t t = treatLightColor(now);                  // the 9th LED: the treat light
  if (t != ledShown[LED_TREAT]) {
    ledShown[LED_TREAT] = t;
    strip.setPixelColor(LED_TREAT, t);
    changed = true;
  }
  if (changed) strip.show();                          // ~270 µs to clock 9 × 24 bits out    //@leds.show
}

// Treat light: pulses orange while a treat waits for a hand, solid green while it drops.
uint32_t treatLightColor(uint32_t now) {
  if (ds != DS_IDLE) return 0x3DDC84;                 // dropping: solid green                //@light.drop
  if (!offerPending) return 0;                        // nothing to give: off
  float breath = 0.25f + 0.75f * (0.5f + 0.5f * sinf(now / 250.0f));   // ~1.6 s breathing     //@light.wait
  return dimColor(0xFF8A1A, breath);
}

// ---------------------------------------------------------------- treat dispenser (SG90 servo)
// A 50 Hz pulse of 0.5..2.4 ms sets the angle. Turning the paddle wheel 90° drops one treat.
Servo wheel;
const int SERVO_REST = 0, SERVO_DROP = 90;
// (DispenseStep ds / dsAt are declared in hungry_simon.ino: the LED code above needs them)

void servoBegin() {
  wheel.setPeriodHertz(50);
  wheel.attach(PIN_SERVO, 500, 2400);
  wheel.write(SERVO_REST);
}

// A win (or the web app) OFFERS a treat. It only drops once a hand is held under the outlet.
bool treatDispense(const char* reason) {
  if (treatsToday >= settings.dailyTreatLimit) {                                            //@treat.limit
    Serial.printf("[treat] blocked: daily limit %d reached\n", settings.dailyTreatLimit);
    cloudPublish("treat/blocked", "{\"reason\":\"daily_limit\"}");
    return false;
  }
  if (offerPending || ds != DS_IDLE) return false;    // one treat at a time
  offerPending = true;                                // light pulses, display says "hand under"  //@treat.offer
  offerSince = millis();
  Serial.printf("[treat] ready (%s): hold your hand under the outlet\n", reason);
  return true;
}

// Called every loop(): drop the waiting treat when the ToF sensor sees a hand.
void treatOfferTick(uint32_t now) {
  if (!offerPending || ds != DS_IDLE) return;
  if (handPresent) {                                                                         //@treat.hand
    offerPending = false;
    Serial.printf("[treat] hand detected at %d mm -> drop\n", tofMm);
    treatDrop();
  } else if (now - offerSince > OFFER_TIMEOUT_MS) {   // nobody took it: cancel, not counted
    offerPending = false;
    Serial.println("[treat] offer expired");                                                 //@treat.expired
    cloudPublish("treat/expired", "{}");
  }
}

void treatDrop() {
  dropSeen = false;
  wheel.write(SERVO_DROP);                            // turn the wheel: one treat falls       //@servo.dispense
  ds = DS_TURN;
  dsAt = millis();
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
  treatOfferTick(now);
  servoTick(now);
}
