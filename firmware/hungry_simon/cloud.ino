// ================================================================= cloud.ino: Wi-Fi + MQTT over TLS
// Topics: hungrysimon/<DEVICE_ID>/...   device → cloud: state, stats, score, treat/*, alert/*
//                                       cloud → device: cmd/settings, cmd/song, cmd/player, cmd/dispense

WiFiClientSecure tls;            // encrypted TCP connection
PubSubClient mqtt(tls);          // MQTT on top of it
char topicBase[40];
uint32_t lastConnectTryMs = 0;

void cloudBegin() {
  snprintf(topicBase, sizeof topicBase, "hungrysimon/%s/", DEVICE_ID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);          // returns at once; connects in the background         //@cloud.wifi
  tls.setCACert(ROOT_CA);                    // only trust the broker's real certificate (TLS)      //@cloud.tls
  mqtt.setServer(MQTT_HOST, 8883);           // 8883 = MQTT over TLS
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMqttMessage);
  configTime(3600, 3600, "pool.ntp.org");    // clock for the daily treat counter (CET/CEST)
}

void cloudLoop(uint32_t now) {
  if (WiFi.status() != WL_CONNECTED) return;          // no Wi-Fi: the instrument still works offline
  if (!mqtt.connected()) {
    if (now - lastConnectTryMs < 5000) return;        // retry every 5 s
    lastConnectTryMs = now;
    char willTopic[64];
    snprintf(willTopic, sizeof willTopic, "%sstatus", topicBase);
    // The TLS handshake blocks for about a second, but only when (re)connecting.
    // The "last will" tells the broker to publish "offline" if we vanish.
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS, willTopic, 1, true, "offline")) {         //@cloud.connect
      mqtt.publish(willTopic, "online", true);
      char sub[64];
      snprintf(sub, sizeof sub, "%scmd/#", topicBase);
      mqtt.subscribe(sub, 1);                         // QoS 1: commands are delivered at least once
      Serial.println("[mqtt] connected over TLS, subscribed to cmd/#");
    }
    return;
  }
  mqtt.loop();                  // keep-alive + calls onMqttMessage() for each incoming message      //@cloud.loop
}

void cloudPublish(const char* subtopic, const char* json) {
  char topic[80];
  snprintf(topic, sizeof topic, "%s%s", topicBase, subtopic);
  Serial.printf("[mqtt] publish %s %s\n", topic, json);
  if (mqtt.connected()) mqtt.publish(topic, json);                                                //@cloud.publish
}

void cloudPublishScore(uint32_t avgTimingErrorMs) {
  char json[160];
  snprintf(json, sizeof json,
           "{\"player\":\"%s\",\"mode\":\"%s\",\"difficulty\":%d,\"score\":%lu,\"avgTimingErrorMs\":%lu}",
           player, MODE_NAMES[mode], settings.difficulty, score, avgTimingErrorMs);
  cloudPublish("score", json);
}

void cloudPublishStats() {
  char json[128];
  snprintf(json, sizeof json, "{\"gamesPlayed\":%lu,\"treatsToday\":%d,\"battery\":%.2f}",
           gamesPlayed, treatsToday, batteryV);
  cloudPublish("stats", json);
}

// Called from mqtt.loop() when the web app sends a command
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;  // not valid JSON: ignore
  const char* cmd = topic + strlen(topicBase);        // e.g. "cmd/settings"
  Serial.printf("[mqtt] received %s\n", cmd);                                                     //@cloud.receive

  if (!strcmp(cmd, "cmd/settings")) {
    const char* d = doc["difficulty"] | "";
    if (!strcmp(d, "easy")) settings.difficulty = EASY;
    if (!strcmp(d, "normal")) settings.difficulty = NORMAL;
    if (!strcmp(d, "hard")) settings.difficulty = HARD;
    if (doc["volume"].is<float>()) settings.volume = doc["volume"].as<float>() * 100;
    if (doc["dailyTreatLimit"].is<int>()) settings.dailyTreatLimit = doc["dailyTreatLimit"];
    Serial.printf("[settings] difficulty=%d volume=%d%% limit=%d\n",
                  settings.difficulty, settings.volume, settings.dailyTreatLimit);                //@cloud.settings
  } else if (!strcmp(cmd, "cmd/song")) {
    settings.songIndex = songIndexById(doc["song"] | "ode");
    gameStart(MODE_SONG);                                                                         //@cloud.song
  } else if (!strcmp(cmd, "cmd/player")) {
    strlcpy(player, doc["player"] | "Player 1", sizeof player);                                  //@cloud.player
  } else if (!strcmp(cmd, "cmd/dispense")) {
    treatDispense("remote");                          // the daily limit still applies             //@cloud.dispense
  }
}
