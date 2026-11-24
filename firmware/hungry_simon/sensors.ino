// ================================================================= sensors.ino: presence, treat sensors, battery, deep sleep


uint32_t lastPollMs = 0, lastBatteryMs = 0;

// ---------------------------------------------------------------- ToF hand sensor (TOF400C-VL53L1X, I2C)
// The VL53L1X sends out invisible 940 nm laser pulses and times how long the light takes to bounce
// back (time of flight). It looks DOWN from the treat outlet: normally it sees the bowl; a hand held
// under the outlet is much closer.
VL53L1X tof;
uint16_t tofBaselineMm = 180;      // distance to the empty bowl, measured at start-up
const uint16_t HAND_MARGIN_MM = 50;    // a hand is at least 5 cm closer than the bowl
uint8_t handCount = 0;             // consecutive "close" readings (debounce)
bool tofOk = false;

void tofBegin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(400000);                       // fast-mode I2C
  tof.setTimeout(100);
  tofOk = tof.init();                          // talks to the sensor at I2C address 0x29      //@tof.init
  if (!tofOk) { Serial.println("[tof] VL53L1X not found: check wiring"); return; }
  tof.setDistanceMode(VL53L1X::Short);         // up to ~1.3 m, best in ambient light
  tof.setMeasurementTimingBudget(33000);       // 33 ms per measurement
  tof.startContinuous(50);                     // a new distance every 50 ms (20 Hz)
  uint32_t sum = 0;
  for (int i = 0; i < 5; i++) sum += tof.read();   // blocking is fine once, during setup()
  tofBaselineMm = sum / 5;
  Serial.printf("[tof] ready, bowl at %d mm\n", tofBaselineMm);
}

void tofPoll() {
  if (!tofOk || !tof.dataReady()) return;     // new reading only every 50 ms
  tofMm = tof.read(false);                     // non-blocking read over I2C                  //@tof.read
  bool close = tof.ranging_data.range_status == VL53L1X::RangeValid &&
               tofMm + HAND_MARGIN_MM < tofBaselineMm;
  handCount = close ? min(handCount + 1, 3) : 0;
  bool hand = handCount >= 2;                  // 2 readings in a row (100 ms): really a hand  //@tof.hand
  if (hand != handPresent) {
    handPresent = hand;
    Serial.printf("[tof] %s (%d mm)\n", hand ? "hand under the outlet" : "hand gone", tofMm);
    if (hand) lastActivityMs = millis();
  }
}

// A treat passes the slide sensor in a few ms: too short to catch by polling, so use an interrupt.
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
  tofPoll();                                           // ToF at its own 20 Hz pace
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
    batteryV = analogReadMilliVolts(PIN_BATTERY) * 2 / 1000.0f;   // ×2: 100k/100k divider     //@sensors.battery
    if (batteryV < 3.4f) Serial.printf("[battery] low: %.2f V\n", batteryV);
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
void sleepCheck(uint32_t now) {
  if (presence || offerPending || now - lastActivityMs < SLEEP_AFTER_MS || ds != DS_IDLE) return;
  Serial.println("[sleep] nobody here -> deep sleep");                                        //@sleep.enter
  cloudPublish("state", "{\"awake\":false}");
  ledsOff();
  displayOff();
  ledcWrite(PIN_SPEAKER, 0);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 1);        // wake when the PIR output goes HIGH     //@sleep.arm
  Serial.flush();
  esp_deep_sleep_start();                              // CPU off. Waking = a fresh setup()      //@sleep.start
}
