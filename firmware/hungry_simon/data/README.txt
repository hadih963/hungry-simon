Sound clips for Hungry Simon. They are uploaded to the ESP32's flash (LittleFS) with the
"Upload LittleFS to Pico/ESP8266/ESP32" tool in Arduino IDE 2 (plugin arduino-littlefs-upload).

Format: WAV, 16 kHz, 16-bit, mono, PCM. Keep them short: the 4 MB flash also holds the firmware.
  notes/0.wav … notes/7.wav    one clip per key: Do Re Mi Fa Sol La Si Do'
  fx/success.wav  fx/win.wav  fx/error.wav  fx/tick.wav

Missing clips are fine: the firmware then synthesises a tone instead.
Budget: 16 kHz × 2 bytes = 32 KB per second. About 1.3 MB of flash is free for clips ≈ 40 s.
