// ================================================================= game.ino: the four modes
// Everything is a state machine driven by millis(): gameTick() runs every loop() and moves the
// game forward when enough time has passed. No delay() anywhere.

// ---------------------------------------------------------------- songs (public domain, C4..C5)
// {key, length in half beats}   keys: 0=Do 1=Re 2=Mi 3=Fa 4=Sol 5=La 6=Si 7=Do'
const Note SONG_ODE[] = {
  {2,2},{2,2},{3,2},{4,2},{4,2},{3,2},{2,2},{1,2},{0,2},{0,2},{1,2},{2,2},{2,3},{1,1},{1,4},
  {2,2},{2,2},{3,2},{4,2},{4,2},{3,2},{2,2},{1,2},{0,2},{0,2},{1,2},{2,2},{1,3},{0,1},{0,4}};
const Note SONG_TWINKLE[] = {
  {0,2},{0,2},{4,2},{4,2},{5,2},{5,2},{4,4},{3,2},{3,2},{2,2},{2,2},{1,2},{1,2},{0,4},
  {4,2},{4,2},{3,2},{3,2},{2,2},{2,2},{1,4},{4,2},{4,2},{3,2},{3,2},{2,2},{2,2},{1,4},
  {0,2},{0,2},{4,2},{4,2},{5,2},{5,2},{4,4},{3,2},{3,2},{2,2},{2,2},{1,2},{1,2},{0,4}};
const Note SONG_MARY[] = {
  {2,2},{1,2},{0,2},{1,2},{2,2},{2,2},{2,4},{1,2},{1,2},{1,4},{2,2},{4,2},{4,4},
  {2,2},{1,2},{0,2},{1,2},{2,2},{2,2},{2,2},{2,2},{1,2},{1,2},{2,2},{1,2},{0,8}};
const Note SONG_JINGLE[] = {
  {2,2},{2,2},{2,4},{2,2},{2,2},{2,4},{2,2},{4,2},{0,3},{1,1},{2,8},
  {3,2},{3,2},{3,3},{3,1},{3,2},{2,2},{2,2},{2,1},{2,1},{2,2},{1,2},{1,2},{2,2},{1,4},{4,4}};
const Note SONG_SCALE[] = {
  {0,2},{1,2},{2,2},{3,2},{4,2},{5,2},{6,2},{7,4},{6,2},{5,2},{4,2},{3,2},{2,2},{1,2},{0,4}};

#define LEN(a) (sizeof(a) / sizeof((a)[0]))
const Song SONGS[] = {
  {"ode",     "Ode to Joy",            96, SONG_ODE,     LEN(SONG_ODE)},
  {"twinkle", "Twinkle Twinkle",      100, SONG_TWINKLE, LEN(SONG_TWINKLE)},
  {"mary",    "Mary Had a Little Lamb",108, SONG_MARY,   LEN(SONG_MARY)},
  {"jingle",  "Jingle Bells",         120, SONG_JINGLE,  LEN(SONG_JINGLE)},
  {"scale",   "Warm-up scale",         90, SONG_SCALE,   LEN(SONG_SCALE)},
};
const uint8_t SONG_COUNT = LEN(SONGS);

uint8_t songIndexById(const char* id) {
  for (uint8_t i = 0; i < SONG_COUNT; i++) if (!strcmp(SONGS[i].id, id)) return i;
  return 0;
}

// ---------------------------------------------------------------- game-only state
uint32_t stateAt = 0;       // millis() when the current state began
uint16_t gapMs = 560;       // Simon: time between shown notes
uint8_t  shownIdx = 0;      // Simon: how many notes have been shown
float    beatMs = 600;      // song: length of one beat
uint8_t  countBeat = 0;     // song: 4-3-2-1 count-in
uint16_t combo = 0;
uint32_t sumAbsOffsetMs = 0; uint16_t hits = 0;   // song: timing statistics

bool isSimonLike() { return mode == MODE_SIMON || mode == MODE_PET; }
const DifficultyCfg& cfg() { return DIFF[settings.difficulty]; }
uint8_t randomKey() { return mode == MODE_PET ? PET_KEYS[random(4)] : random(8); }
void setState(State s) { state = s; stateAt = millis(); }

// ---------------------------------------------------------------- start / stop
void gameStart(Mode m) {
  mode = m; score = 0; combo = 0; litKey = -1;
  Serial.printf("[game] mode = %s\n", MODE_NAMES[m]);                                   //@game.start
  if (isSimonLike())        simonStart(true);
  else if (m == MODE_SONG)  songStart(false);
  else                      setState(ST_IDLE);   // free play: keys just make sound
}

// Called by onKeyDown() in keys.ino
void gameKeyDown(int k, uint32_t now) {
  if (isSimonLike())        simonKey(k);
  else if (mode == MODE_SONG) songKey(k, now);
}

// ---------------------------------------------------------------- Simon says / pet mode
void simonStart(bool fresh) {
  if (fresh) wins = 0;
  bool pet = (mode == MODE_PET);
  goal  = pet ? 3   : cfg().simonGoal + wins * 2;                      // longer goal after every win
  gapMs = pet ? 850 : max(260, (int)(cfg().gapMs * pow(0.88, wins)));  // ...and faster
  seqLen = pet ? 1 : cfg().simonStart;
  for (uint8_t i = 0; i < seqLen; i++) seq[i] = randomKey();                             //@simon.new
  gamesPlayed++;
  cloudPublishStats();
  setState(ST_READY);
}

void simonShow() {
  shownIdx = 0; seqPos = 0;
  Serial.printf("[simon] watch: %d notes\n", seqLen);                                    //@simon.show
  setState(ST_WATCH);
}

void simonKey(int k) {
  if (state != ST_INPUT) return;                     // ignore keys while Simon is showing
  if (k != seq[seqPos]) { gameFail("wrong note"); return; }                              //@simon.wrong
  seqPos++;                                                                              //@simon.correct
  Serial.printf("[simon] %s correct (%d/%d)\n", NOTE_NAMES[k], seqPos, seqLen);
  if (seqPos < seqLen) return;                       // more notes to go

  score += seqLen * (mode == MODE_PET ? 5 : 10) * (1 + wins);
  if (seqLen >= goal) { wins++; gameWin(); return; }                                     //@simon.goal
  soundSuccess();
  seq[seqLen++] = randomKey();                       // one note longer next round         //@simon.grow
  Serial.printf("[simon] round done, next length %d\n", seqLen);
  setState(ST_READY);
}

// ---------------------------------------------------------------- song challenge
void songStart(bool retry) {
  song = &SONGS[settings.songIndex];
  beatMs = 60000.0f / (song->bpm * cfg().tempo);
  uint32_t t = 0;
  for (uint8_t i = 0; i < song->len; i++) {          // when must each note be played?        //@song.chart
    noteTimeMs[i] = t;
    t += song->notes[i].halfBeats * beatMs / 2;
  }
  noteIdx = 0; combo = 0; score = 0; sumAbsOffsetMs = 0; hits = 0;
  songStartMs = millis() + max((uint32_t)(FALL_MS + 300), (uint32_t)(4 * beatMs + 600));
  countBeat = 5;
  gamesPlayed++;
  Serial.printf("[song] %s%s: %d notes, beat %d ms\n", song->title, retry ? " (retry)" : "", song->len, (int)beatMs);  //@song.start
  setState(ST_COUNTIN);
}

void songKey(int k, uint32_t now) {
  if (state == ST_WON) { if (now - stateAt > 1500) songStart(false); return; }   // any key: play again
  if (state != ST_PLAY && state != ST_COUNTIN) return;

  int32_t off = (int32_t)(now - songStartMs) - (int32_t)noteTimeMs[noteIdx];   // <0 early, >0 late  //@song.timing
  int32_t w = cfg().windowMs;
  uint8_t want = song->notes[noteIdx].key;
  if (state == ST_COUNTIN && !(k == want && off >= -w)) return;   // noodling during the count-in is fine

  if (k != want) { gameFail("wrong note"); return; }                                     //@song.wrong
  if (off < -w)  { gameFail("too early");  return; }
  if (off > w)   { gameFail("too late");   return; }

  state = ST_PLAY;
  noteIdx++; combo++; hits++;
  sumAbsOffsetMs += abs(off);
  float accuracy = 1.0f - abs(off) / (float)w;
  score += (50 + 50 * accuracy) * (1 + min((int)combo, 20) / 10.0f);
  Serial.printf("[song] hit %s %+d ms (%s)\n", NOTE_NAMES[k], (int)off, accuracy > 0.6f ? "perfect" : "good");  //@song.hit
  if (noteIdx >= song->len) gameWin();                                                   //@song.complete
}

// ---------------------------------------------------------------- outcomes
void gameFail(const char* reason) {
  combo = 0; litKey = -1;
  soundError();
  ledsFlash(0xFF2D2D, 380);
  Serial.printf("[game] %s -> try again\n", reason);                                     //@game.fail
  setState(ST_FAIL);
}

void gameWin() {
  soundWin();
  ledsFlash(0x3DDC84, 650);
  Serial.printf("[game] WIN! score %lu\n", score);                                       //@game.win
  cloudPublishScore(hits ? sumAbsOffsetMs / hits : 0);
  treatDispense("game won");                         // the reward!                       //@game.treat
  setState(ST_WON);
}

// ---------------------------------------------------------------- the clock: called every loop()
void gameTick(uint32_t now) {
  uint32_t t = now - stateAt;
  switch (state) {
    case ST_READY:                                   // short pause before Simon shows the sequence
      if (t > 800) simonShow();
      break;

    case ST_WATCH: {                                 // Simon shows the sequence, one note per gapMs
      if (t < 450) break;
      uint8_t i = (t - 450) / gapMs;
      if (i >= seqLen) {
        litKey = -1;
        Serial.println("[simon] your turn");                                            //@simon.yourturn
        setState(ST_INPUT);
        break;
      }
      uint16_t onMs = gapMs * 0.62;
      if (i == shownIdx) {                           // start of the next shown note
        soundNote(seq[i], onMs);                                                         //@simon.shownote
        shownIdx++;
      }
      litKey = ((t - 450) % gapMs < onMs) ? seq[i] : -1;
      break;
    }

    case ST_COUNTIN: {                               // 4-3-2-1 before the song starts
      int32_t untilStart = (int32_t)(songStartMs - now);
      uint8_t beat = untilStart > 0 ? (untilStart + (int32_t)beatMs - 1) / (int32_t)beatMs : 0;
      if (beat < countBeat && beat >= 1 && beat <= 4) {
        countBeat = beat;
        soundTickFx(beat == 4);
        Serial.printf("[song] count-in %d\n", beat);                                      //@song.countin
      }
      if (untilStart <= (int32_t)cfg().windowMs) setState(ST_PLAY);
      break;
    }

    case ST_PLAY:                                    // a note fell past the hit line without being played
      if (noteIdx < song->len && (int32_t)(now - songStartMs - noteTimeMs[noteIdx]) > (int32_t)cfg().windowMs) {
        gameFail("missed");                                                              //@song.missed
      }
      break;

    case ST_FAIL:                                    // after the error sound: try again
      if (t > 1500) {
        Serial.println("[game] restart sequence");                                       //@game.retry
        if (isSimonLike()) simonShow(); else songStart(true);
      }
      break;

    case ST_WON:
      if (isSimonLike() && t > 3200) simonStart(false);   // next, harder challenge
      break;

    default: break;
  }
}

// What the LED under key k should show (besides "held"). 0 = off.
uint32_t gameLedFor(int k, uint32_t now) {
  if (isSimonLike() && state == ST_WATCH && litKey == k) return KEY_COLORS[k];
  if (mode == MODE_SONG && (state == ST_PLAY || state == ST_COUNTIN) && noteIdx < song->len
      && song->notes[noteIdx].key == k) {
    int32_t dt = (int32_t)noteTimeMs[noteIdx] - (int32_t)(now - songStartMs);
    if (dt < FALL_MS) {                              // next key lights up, brighter as it gets close  //@leds.hint
      float level = dt < (int32_t)cfg().windowMs ? 1.0f : 0.3f + 0.5f * (1.0f - dt / (float)FALL_MS);
      return dimColor(KEY_COLORS[k], level);
    }
  }
  return 0;
}
