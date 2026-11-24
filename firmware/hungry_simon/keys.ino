// ================================================================= keys.ino: 8 piano keys + the BOOT button
// Each hinged key presses a KW11-3Z lever microswitch: COM to GND, NO to the GPIO.
// So: pressed = LOW, released = HIGH (internal pull-up).
// Metal contacts "bounce" for a few ms, so a new level only counts once it has been stable for 15 ms.

const uint16_t DEBOUNCE_MS = 15;

Debounce keyDb[8];        // struct Debounce is declared in hungry_simon.ino
Debounce btnModeDb = {HIGH, HIGH, 0};
uint32_t btnDownAt = 0;
const uint16_t LONG_PRESS_MS = 800;

void keysBegin() {
  for (int i = 0; i < 8; i++) {
    pinMode(KEY_PINS[i], INPUT_PULLUP);   // all 8 key pins have an internal pull-up
    keyDb[i] = {HIGH, HIGH, 0};
  }
  pinMode(PIN_BTN_MODE, INPUT_PULLUP);    // BOOT button on the DevKit (also used to enter flash mode)
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

// The DevKit V1 has one free button (BOOT): a short press = next mode, a long press = difficulty.
void buttonsScan(uint32_t now) {
  if (!debounce(btnModeDb, digitalRead(PIN_BTN_MODE), now)) return;
  if (btnModeDb.stable == LOW) { btnDownAt = now; return; }        // pressed: start timing
  lastActivityMs = now;
  if (now - btnDownAt < LONG_PRESS_MS) {                           // released after a short press
    Mode next = (Mode)((mode + 1) % 4);
    Serial.printf("[button] mode -> %s\n", MODE_NAMES[next]);                               //@buttons.mode
    gameStart(next);
  } else {                                                         // released after a long press
    settings.difficulty = (Difficulty)((settings.difficulty + 1) % 3);
    Serial.printf("[button] difficulty -> %d\n", settings.difficulty);                      //@buttons.option
    gameStart(mode);
  }
}
