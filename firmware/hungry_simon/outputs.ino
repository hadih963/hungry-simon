// ================================================================= outputs.ino: LED sticks, treat offer, treat servo
// (sound lives in audio.ino)

// ---------------------------------------------------------------- RGB LEDs: 9 WS2812 sticks of 8 on one data pin
// Stick 0..7 sits under key Do..Do'; stick 8 is the treat light at the chute. 72 LEDs in a chain.
Adafruit_NeoPixel strip(NUM_LEDS, PIN_LEDS, NEO_GRB + NEO_KHZ800);
uint32_t stickShown[NUM_STICKS];
uint32_t flashColor = 0, flashUntil = 0;

void ledsBegin() {
  strip.begin();
  // 50 % brightness cap: 72 LEDs at full white would draw 4.3 A, more than the 5 A buck can spare
  // next to the amplifier and servo (see docs/components.md, "Estimated peak current").
  strip.setBrightness(128);
  strip.clear();
  strip.show();
}

void ledsFlash(uint32_t color, uint16_t ms) {        // all key sticks one colour: success / error
  flashColor = color;                                                                        //@leds.flash
  flashUntil = millis() + ms;
}

void ledsOff() { strip.clear(); strip.show(); }

uint32_t dimColor(uint32_t c, float f) {
  return ((uint32_t)(((c >> 16) & 0xFF) * f) << 16) | ((uint32_t)(((c >> 8) & 0xFF) * f) << 8) | (uint32_t)((c & 0xFF) * f);
}

// Give one stick (8 LEDs) a colour; returns true if it changed.
bool setStick(int s, uint32_t c) {
  if (stickShown[s] == c) return false;
  stickShown[s] = c;
  strip.fill(c, s * LEDS_PER_STICK, LEDS_PER_STICK);
  return true;
}

void ledsShow(uint32_t now) {
  bool changed = false;
  for (int i = 0; i < 8; i++) {
    int k = (mode == MODE_PET) ? i - (i % 2) : i;     // pet mode: both sticks of a pair together
    uint32_t c;
    if (now < flashUntil)  c = flashColor;
    else if (keyHeld[k])   c = KEY_COLORS[k];         // a held key glows in its own colour   //@leds.held
    else                   c = gameLedFor(k, now);    // next note / Simon showing / off
    changed |= setStick(i, c);
  }
  changed |= setStick(STICK_TREAT, treatLightColor(now));   // the 9th stick: the treat light
  if (changed) strip.show();                          // ~2.2 ms to clock 72 × 24 bits out    //@leds.show
}

// Treat light (chute stick): pulses orange while a treat waits for a hand, solid green while it drops.
uint32_t treatLightColor(uint32_t now) {
  if (ds != DS_IDLE) return 0x3DDC84;                 // dropping: solid green                //@light.drop
  if (!offerPending) return 0;                        // nothing to give: off
  float breath = 0.25f + 0.75f * (0.5f + 0.5f * sinf(now / 250.0f));   // ~1.6 s breathing     //@light.wait
  return dimColor(0xFF8A1A, breath);
}

// ---------------------------------------------------------------- treat dispenser (MG90S servo)
// A 50 Hz pulse of 0.5..2.4 ms sets the angle. Turning the paddle wheel 90° drops one treat.
Servo wheel;
const int SERVO_REST = 0, SERVO_DROP = 90;
// (DispenseStep ds / dsAt are declared in hungry_simon.ino: the LED code above needs them)

void servoBegin() {
  wheel.setPeriodHertz(50);
  wheel.attach(PIN_SERVO, 500, 2400);
  wheel.write(SERVO_REST);
}

// A win (or the web app) OFFERS a treat. It only drops once a hand is held under the chute.
bool treatDispense(const char* reason) {
  if (treatsToday >= settings.dailyTreatLimit) {                                            //@treat.limit
    Serial.printf("[treat] blocked: daily limit %d reached\n", settings.dailyTreatLimit);
    cloudPublish("treat/blocked", "{\"reason\":\"daily_limit\"}");
    return false;
  }
  if (offerPending || ds != DS_IDLE) return false;    // one treat at a time
  offerPending = true;                                // light pulses, display says "hand under"  //@treat.offer
  offerSince = millis();
  Serial.printf("[treat] ready (%s): hold your hand under the chute\n", reason);
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
      if (dropSeen) {                                 // the IR sensor at the chute saw it fall
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
  treatOfferTick(now);
  servoTick(now);
}
