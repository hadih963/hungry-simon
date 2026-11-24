// ================================================================= audio.ino: MAX98357A over I2S
// The ESP32 sends digital samples (16 kHz, 16-bit, mono) over I2S to the MAX98357A, which turns
// them into a 3 W class-D signal for the 4 Ω speaker. No analog wiring, no noise from the CPU.
//
// Sounds are recorded clips in flash (LittleFS, folder data/ of this sketch):
//   /notes/0.wav … /notes/7.wav   one per key (Do … Do')
//   /fx/success.wav  /fx/win.wav  /fx/error.wav  /fx/tick.wav
// 16 kHz, 16-bit, mono WAV. If a clip is missing, a sine tone is synthesised instead, so the
// device works before anybody has recorded anything.
//
// Audio runs in its own FreeRTOS task on core 0: loop() only drops a command in a queue, so a
// slow file read can never delay the keys or the screen. Delay from key to sound ≈ 10–20 ms.

const uint32_t SAMPLE_RATE = 16000;
const int BUF_SAMPLES = 128;                 // 8 ms of audio per I2S write

enum SoundKind : uint8_t { SND_NOTE_ON, SND_NOTE_OFF, SND_NOTE_FOR, SND_FX };
struct SoundCmd { SoundKind kind; int8_t key; uint16_t ms; char clip[20]; Beep tones[6]; uint8_t nTones; };

I2SClass i2s;
QueueHandle_t soundQueue;

const Beep FX_SUCCESS[] = {{523, 70}, {659, 70}, {784, 120}};
const Beep FX_WIN[]     = {{523, 110}, {659, 110}, {784, 110}, {1047, 110}, {784, 110}, {1047, 260}};
const Beep FX_ERROR[]   = {{185, 200}, {139, 350}};

void soundBegin() {
  if (!LittleFS.begin(true)) Serial.println("[audio] LittleFS mount failed: synth only");
  i2s.setPins(PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DOUT);
  if (!i2s.begin(I2S_MODE_STD, SAMPLE_RATE, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("[audio] I2S start failed");
  }
  soundQueue = xQueueCreate(8, sizeof(SoundCmd));
  xTaskCreatePinnedToCore(audioTask, "audio", 6144, nullptr, 3, nullptr, 0);   // core 0, loop() is on core 1
}

// ---------------------------------------------------------------- called from loop(): never blocks
void soundSend(SoundKind kind, int8_t key, uint16_t ms) {
  SoundCmd c = {};
  c.kind = kind; c.key = key; c.ms = ms;
  xQueueSend(soundQueue, &c, 0);             // 0 = don't wait if the queue is full
}

void soundNoteOn(int k)  { soundSend(SND_NOTE_ON, k, 0); }                          //@sound.on
void soundNoteOff(int k) { soundSend(SND_NOTE_OFF, k, 0); }                         //@sound.off
void soundNote(int k, uint16_t ms) { soundSend(SND_NOTE_FOR, k, ms); }              //@sound.note

void soundPlayFx(const char* clip, const Beep* tones, uint8_t n) {
  SoundCmd c = {};
  c.kind = SND_FX;
  strlcpy(c.clip, clip, sizeof c.clip);                                              //@sound.fx
  c.nTones = min((int)n, 6);
  memcpy(c.tones, tones, c.nTones * sizeof(Beep));
  xQueueSend(soundQueue, &c, 0);
}
void soundSuccess()        { soundPlayFx("/fx/success.wav", FX_SUCCESS, 3); }
void soundWin()            { soundPlayFx("/fx/win.wav", FX_WIN, 6); }
void soundError()          { soundPlayFx("/fx/error.wav", FX_ERROR, 2); }
void soundTickFx(bool hi)  { Beep b = {(uint16_t)(hi ? 1568 : 1047), 35}; soundPlayFx("/fx/tick.wav", &b, 1); }

// ---------------------------------------------------------------- the audio task (core 0)
File  clip;                     // clip being played (if any)
int8_t clipKey = -1;            // which key's note it is (-1 = an effect)
float  fade = 1.0f;             // 1 = full; drops to 0 after a key is released
bool   releasing = false;
uint32_t stopAfter = 0;         // samples left for a fixed-length note (0 = no limit)

Beep  synth[6]; uint8_t synthN = 0, synthIdx = 0;   // fallback tones when there is no clip
uint32_t synthLeft = 0; float phase = 0;

bool openClip(const char* path) {
  if (clip) clip.close();
  clip = LittleFS.open(path, "r");
  if (!clip) return false;
  clip.seek(44);                // skip the WAV header: raw samples follow
  return true;
}

void startSound(const SoundCmd& c) {
  releasing = false; fade = 1.0f; synthN = 0; stopAfter = 0;
  if (c.kind == SND_FX) {
    clipKey = -1;
    if (!openClip(c.clip)) { memcpy(synth, c.tones, c.nTones * sizeof(Beep)); synthN = c.nTones; synthIdx = 0; synthLeft = 0; }
    return;
  }
  char path[20];
  snprintf(path, sizeof path, "/notes/%d.wav", c.key);
  clipKey = c.key;
  if (!openClip(path)) { synth[0] = {NOTE_HZ[c.key], 2000}; synthN = 1; synthIdx = 0; synthLeft = 0; }
  if (c.kind == SND_NOTE_FOR) stopAfter = (uint32_t)c.ms * SAMPLE_RATE / 1000;
}

void audioTask(void*) {
  int16_t buf[BUF_SAMPLES];
  SoundCmd cmd;
  for (;;) {
    while (xQueueReceive(soundQueue, &cmd, 0) == pdTRUE) {           // new commands from loop()
      if (cmd.kind == SND_NOTE_OFF) { if (cmd.key == clipKey) releasing = true; }
      else startSound(cmd);
    }

    float gain = settings.volume / 100.0f;
    int n = 0;
    if (clip) {                                                      // recorded clip from flash
      n = clip.read((uint8_t*)buf, sizeof buf) / 2;
      if (n < BUF_SAMPLES) clip.close();
    } else if (synthIdx < synthN) {                                  // synthesised fallback tone
      for (; n < BUF_SAMPLES; n++) {
        if (synthLeft == 0) {
          if (synthIdx >= synthN) break;
          synthLeft = (uint32_t)synth[synthIdx].ms * SAMPLE_RATE / 1000;
          phase = 0;
        }
        float env = clipKey >= 0 ? expf(-phase / (SAMPLE_RATE * 6.0f)) : 1.0f;   // notes decay like a piano
        buf[n] = (int16_t)(sinf(2 * PI * synth[synthIdx].hz * phase / SAMPLE_RATE) * 9000 * env);
        phase++;
        if (--synthLeft == 0) synthIdx++;
      }
    }
    for (int i = 0; i < n; i++) {                                    // volume, release fade, length limit
      if (releasing) fade = max(0.0f, fade - 1.0f / (SAMPLE_RATE * 0.06f));   // 60 ms fade-out
      if (stopAfter && --stopAfter == 0) releasing = true;
      buf[i] = (int16_t)(buf[i] * gain * fade);
    }
    if (releasing && fade <= 0.0f) { if (clip) clip.close(); synthN = 0; releasing = false; }
    for (int i = n; i < BUF_SAMPLES; i++) buf[i] = 0;               // silence
    i2s.write((uint8_t*)buf, sizeof buf);    // blocks until the DMA has room: this paces the task
  }
}
