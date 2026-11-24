// ================================================================= sensors.ino: presence, treat sensors, battery, deep sleep


uint32_t lastPollMs = 0, lastBatteryMs = 0;

// A treat passes the slide sensor in a few ms: too short to catch by polling, so use an interrupt.
void IRAM_ATTR onTreatDrop() { dropSeen = true; }

void sensorsBegin() {
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_IR_LEVEL, INPUT);
  pinMode(PIN_IR_DROP, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_DROP), onTreatDrop, FALLING);
  analogReadResolution(12);
}

void sensorsPoll(uint32_t now) {
  if (dropSeen && ds == DS_WAIT_DROP) {                // the interrupt fired                    //@sensors.drop
    // handled in servoTick(); nothing else to do here
  }
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
  if (presence || now - lastActivityMs < SLEEP_AFTER_MS || ds != DS_IDLE) return;
  Serial.println("[sleep] nobody here -> deep sleep");                                        //@sleep.enter
  cloudPublish("state", "{\"awake\":false}");
  ledsOff();
  displayOff();
  ledcWrite(PIN_SPEAKER, 0);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 1);        // wake when the PIR output goes HIGH     //@sleep.arm
  Serial.flush();
  esp_deep_sleep_start();                              // CPU off. Waking = a fresh setup()      //@sleep.start
}
