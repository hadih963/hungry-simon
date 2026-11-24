// ================================================================= keys.ino: 8 piano keys + 2 buttons
// A key connects its pin to GND, so: pressed = LOW, released = HIGH (pull-up).
// Metal contacts "bounce" for a few ms, so a new level only counts once it has been stable for 15 ms.

const uint16_t DEBOUNCE_MS = 15;

Debounce keyDb[8];        // struct Debounce is declared in hungry_simon.ino
Debounce btnModeDb   = {HIGH, HIGH, 0};
Debounce btnOptionDb = {HIGH, HIGH, 0};

void keysBegin() {
  for (int i = 0; i < 8; i++) {
    pinMode(KEY_PINS[i], INPUT_PULLUP);   // GPIO 36/37 have no internal pull-up: 10k resistor on the board
    keyDb[i] = {HIGH, HIGH, 0};
  }
  pinMode(PIN_BTN_MODE, INPUT_PULLUP);
  pinMode(PIN_BTN_OPTION, INPUT);         // has an external pull-up on the T-Display
}

// Returns true exactly once when the input settles on a new level.
bool debounce(Debounce& d, bool reading, uint32_t now) {
  if (reading != d.lastRead) {           // raw level changed: (re)start the timer          //@keys.bounce
    d.lastRead = reading;
    d.changedAt = now;
  }
  if (reading != d.stable && now - d.changedAt >= DEBOUNCE_MS) {                           //@keys.debounce
    d.stable = reading;                  // stable for 15 ms: accept it
    return true;
  }
  return false;
}

void keysScan(uint32_t now) {
  for (int i = 0; i < 8; i++) {
    bool reading = digitalRead(KEY_PINS[i]);                                                 //@keys.read
    if (!debounce(keyDb[i], reading, now)) continue;

    int k = (mode == MODE_PET) ? i - (i % 2) : i;   // pet mode: both keys of a pair = one big key
    if (keyDb[i].stable == LOW) onKeyDown(k, now);
    else                        onKeyUp(k, now);
  }
}

void onKeyDown(int k, uint32_t now) {
  Serial.printf("[key] %s down (GPIO %d) t=%lu ms\n", NOTE_NAMES[k], KEY_PINS[k], now);    //@keys.down
  lastActivityMs = now;
  keyHeld[k] = true;
  soundNoteOn(k);          // every key plays its own note, in every mode                  //@keys.sound
  gameKeyDown(k, now);     // the current mode decides if it was right, and in time         //@keys.game
}

void onKeyUp(int k, uint32_t now) {
  keyHeld[k] = false;                                                                        //@keys.up
  soundNoteOff(k);
}

void buttonsScan(uint32_t now) {
  if (debounce(btnModeDb, digitalRead(PIN_BTN_MODE), now) && btnModeDb.stable == LOW) {
    Mode next = (Mode)((mode + 1) % 4);
    Serial.printf("[button] mode -> %s\n", MODE_NAMES[next]);                               //@buttons.mode
    lastActivityMs = now;
    gameStart(next);
  }
  if (debounce(btnOptionDb, digitalRead(PIN_BTN_OPTION), now) && btnOptionDb.stable == LOW) {
    settings.difficulty = (Difficulty)((settings.difficulty + 1) % 3);
    Serial.printf("[button] difficulty -> %d\n", settings.difficulty);                      //@buttons.option
    lastActivityMs = now;
    gameStart(mode);
  }
}
