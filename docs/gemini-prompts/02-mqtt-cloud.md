# 2. MQTT and cloud architecture

**Attach:** `Project Description - Q2 Group 9.pdf` and `src/core/cloud.js` + `src/main.js` from the repo

**Save the answer as:** `docs/gemini-output/02-mqtt-cloud.md`

## Prompt

You are a cloud/IoT engineer helping a student group design the "Cloud communication" chapter for
**Hungry Simon**, an ESP32 rhythm instrument with a treat dispenser (assignment attached). The ESP32
must connect to a cloud application (for example Google Cloud) with a web app for control and
statistics, using **MQTT over TLS**.

The attached `cloud.js` and `main.js` are a browser simulator of the device. It already uses these
topics, all under the prefix `hungrysimon/<deviceId>/`:
- Device publishes: `state`, `stats`, `score`, `treat/dispensed`, `treat/blocked`,
  `alert/treat_low`, `alert/treat_empty`
- Device subscribes: `cmd/settings` (difficulty, volume, dailyTreatLimit), `cmd/song`,
  `cmd/player`, `cmd/dispense`

Produce, in Markdown:
1. **Architecture diagram** (Mermaid): ESP32 → MQTT broker (TLS 8883) → backend → database →
   web app. Recommend a concrete, student-budget stack and justify it. Note that Google Cloud IoT
   Core was retired in 2023, so suggest a realistic replacement (for example EMQX or HiveMQ Cloud
   free tier, or Mosquitto on a small VM, plus Firestore or Postgres and a simple web front end).
2. **Topic table**: topic, direction, QoS, retained yes/no, example JSON payload. Keep the
   simulator's topic names; add any that are missing (for example a last-will `status`
   online/offline topic and `cmd/settings` acknowledgements).
3. **Security**: TLS setup on the ESP32 (CA certificate, per-device username/password or client
   certificates), topic ACLs so a device can only use its own topics, and secret storage on the
   ESP32 (NVS, not hard-coded).
4. **Deep sleep and MQTT**: what happens to commands sent while the device sleeps (persistent
   session / clean session = false, retained settings, QoS 1). Explain how a "remote dispense"
   sent during sleep should be handled, and what the daily limit means.
5. **ESP32 C implementation sketch**: which library to use (ESP-IDF `esp-mqtt` or Arduino
   PubSubClient / AsyncMqttClient), connect → subscribe → publish flow, reconnect with backoff,
   and a minimal code skeleton (about 60 lines) for TLS connect + subscribe + publish JSON.
6. **Statistics the web app should show**, and the database schema (tables/collections and fields)
   needed for per-player scores and progress, games played, treats dispensed and alerts.

Keep it practical for first-year students. Cite official documentation names (no made-up URLs).
