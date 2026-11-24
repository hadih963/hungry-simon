// ================================================================= sensors.ino: presence, hand sensor, treat sensors, battery, deep sleep

uint32_t lastPollMs = 0, lastBatteryMs = 0;

// ---------------------------------------------------------------- hand / paw sensor: VL53L7CX 8x8 multizone ToF
// The VL53L7CX sends out invisible 940 nm laser light and measures, for each of 8 x 8 = 64 zones in
// its 60° x 60° view, how long the light takes to bounce back (time of flight). It looks DOWN from
// the chute: normally every zone sees the bowl or the floor. A hand or paw is much closer, and
// because it covers several zones, a single stray reading (a falling treat, a fly) is ignored.
VL53L7CX tof(&Wire, -1);                 // LPn is tied to 3.3 V on the board, so no pin (-1)
VL53L7CX_ResultsData tofData;
uint16_t baseline[64];                   // empty-chute distance per zone, measured at start-up
const uint16_t HAND_MARGIN_MM = 50;      // a hand is at least 5 cm closer than the background
const uint8_t  HAND_ZONES = 4;           // ...in at least 4 of the 16 centre zones
uint8_t handCount = 0;                   // consecutive frames that saw a hand (debounce)
bool tofOk = false;

// Distance of zone z (0..63) in the latest frame, or 0 if that zone has no valid target.
uint16_t zoneMm(int z) {
  uint8_t st = tofData.target_status[VL53L7CX_NB_TARGET_PER_ZONE * z];
  if (st != 5 && st != 9) return 0;      // 5 / 9 = valid measurement (see the ST user manual)
  return tofData.distance_mm[VL53L7CX_NB_TARGET_PER_ZONE * z];
}

bool tofFrame() {                        // true if a new 8x8 frame was read
  uint8_t ready = 0;
  if (tof.vl53l7cx_check_data_ready(&ready) || !ready) return false;
  return tof.vl53l7cx_get_ranging_data(&tofData) == 0;                                        //@tof.read
}

void tofBegin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(400000);                         // fast-mode I2C
  tof.begin();
  // init_sensor() uploads ST's ~84 KB ranging firmware into the sensor over I2C: takes 1–2 s
  if (tof.init_sensor() != 0) { Serial.println("[tof] VL53L7CX not found: check wiring"); return; }   //@tof.init
  tof.vl53l7cx_set_resolution(VL53L7CX_RESOLUTION_8X8);
  tof.vl53l7cx_set_ranging_frequency_hz(15);     // 15 frames per second
  tof.vl53l7cx_start_ranging();
  tofOk = true;
  for (int z = 0; z < 64; z++) baseline[z] = 2000;
  for (int frames = 0; frames < 5; ) {           // learn the empty chute (blocking is fine in setup())
    if (!tofFrame()) { delay(5); continue; }
    for (int z = 0; z < 64; z++) { uint16_t d = zoneMm(z); if (d) baseline[z] = min(baseline[z], d); }
    frames++;
  }
  Serial.printf("[tof] ready, bowl at %d mm (centre zone)\n", baseline[27]);
}

void tofPoll() {
  if (!tofOk || !tofFrame()) return;             // a new frame only every ~67 ms
  uint8_t close = 0;
  uint16_t nearest = 4000;
  for (int row = 2; row < 6; row++) {            // the 4 x 4 zones in the middle = right under the chute
    for (int col = 2; col < 6; col++) {
      int z = row * 8 + col;
      uint16_t d = zoneMm(z);
      if (d && d + HAND_MARGIN_MM < baseline[z]) { close++; nearest = min(nearest, d); }
    }
  }
  tofMm = close ? nearest : baseline[27];
  handCount = close >= HAND_ZONES ? min(handCount + 1, 3) : 0;
  bool hand = handCount >= 2;                    // 2 frames in a row: really a hand or paw     //@tof.hand
  if (hand != handPresent) {
    handPresent = hand;
    Serial.printf("[tof] %s (%d mm, %d zones)\n", hand ? "hand under the chute" : "hand gone", tofMm, close);
    if (hand) lastActivityMs = millis();
  }
}

// A treat passes the chute sensor in a few ms: too short to catch by polling, so use an interrupt.
void IRAM_ATTR onTreatDrop() { dropSeen = true; }

void sensorsBegin() {
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_IR_LEVEL, INPUT);
  pinMode(PIN_IR_DROP, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_DROP), onTreatDrop, FALLING);
  analogReadResolution(12);
  tofBegin();
}

void sensorsPoll(uint32_t now) {
  if (dropSeen && ds == DS_WAIT_DROP) {                // the interrupt fired                    //@sensors.drop
    // handled in servoTick(); nothing else to do here
  }
  tofPoll();                                           // hand sensor at its own 15 Hz pace
  if (now - lastPollMs < 100) return;                  // 10 Hz is plenty for these sensors
  lastPollMs = now;

  bool p = digitalRead(PIN_PIR) == HIGH;               // HIGH while it sees movement            //@sensors.presence
  if (p != presence) {
    presence = p;
    Serial.printf("[pir] presence: %s\n", p ? "yes" : "no");
    if (p) lastActivityMs = now;
  }

  bool low = digitalRead(PIN_IR_LEVEL) == HIGH;        // HIGH = no treat in front of it         //@sensors.level
  if (low && !treatLevelLow) {
    Serial.println("[treat] level LOW -> alert");
    cloudPublish("alert/treat_low", "{\"level\":\"low\"}");
  }
  treatLevelLow = low;

  if (now - lastBatteryMs > 10000) {                   // every 10 s
    lastBatteryMs = now;
    batteryV = analogReadMilliVolts(PIN_BATTERY) * (133.0f / 33.0f) / 1000.0f;   // 100k/33k divider  //@sensors.battery
    if (batteryV < 6.8f) Serial.printf("[battery] low: %.2f V (2S pack)\n", batteryV);   // 3.4 V per cell
    dailyReset();
  }
}

// The treat counter starts again every day (clock from NTP, set in cloudBegin()).
void dailyReset() {
  struct tm t;
  if (!getLocalTime(&t, 0)) return;                    // no time yet (no Wi-Fi): keep counting
  if (t.tm_yday != treatDay) {
    treatDay = t.tm_yday;
    treatsToday = 0;
    Serial.println("[treat] new day: counter reset");
  }
}

// Nobody in front of the instrument for a while → deep sleep. The PIR wakes it up again.
// Note: the ESP32 itself then uses ~10 µA, but the 72 WS2812 LEDs (≈1 mA each even when off), the
// amplifier and the display backlight stay on the 5 V rail (≈ 0.1 A). The power switch is the real "off".
void sleepCheck(uint32_t now) {
  if (presence || offerPending || now - lastActivityMs < SLEEP_AFTER_MS || ds != DS_IDLE) return;
  Serial.println("[sleep] nobody here -> deep sleep");                                        //@sleep.enter
  cloudPublish("state", "{\"awake\":false}");
  ledsOff();
  displayOff();
  tof.vl53l7cx_stop_ranging();                          // sensor to low power
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_36, 1);        // wake when the PIR output goes HIGH     //@sleep.arm
  Serial.flush();
  esp_deep_sleep_start();                              // CPU off. Waking = a fresh setup()      //@sleep.start
}
