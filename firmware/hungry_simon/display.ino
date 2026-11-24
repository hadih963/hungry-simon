// ================================================================= display.ino: falling notes on the 240×135 TFT
// Each frame is drawn into a sprite (an off-screen frame buffer in RAM) and sent to the screen in
// one go, so the picture never flickers.

TFT_eSPI tft;
TFT_eSprite frame(&tft);
uint32_t lastDrawMs = 0;

const int W = 240, H = 135, TOP = 14, HIT_Y = 118;

void displayBegin() {
  tft.init();
  tft.setRotation(1);                    // landscape
  frame.createSprite(W, H);              // 240 × 135 × 2 bytes ≈ 63 KB of RAM
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);            // backlight on
}

void displayOff() {
  digitalWrite(TFT_BL, LOW);
  tft.writecommand(TFT_DISPOFF);
}

uint16_t to565(uint32_t c) { return tft.color565(c >> 16, (c >> 8) & 0xFF, c & 0xFF); }

void displayDraw(uint32_t now) {
  if (now - lastDrawMs < 40) return;     // 25 frames per second (brief: at least 20)           //@display.rate
  lastDrawMs = now;

  frame.fillSprite(TFT_BLACK);
  int lanes = (mode == MODE_PET) ? 4 : 8;
  int laneW = W / lanes;

  // coloured key markers at the bottom, bright while held
  for (int l = 0; l < lanes; l++) {
    int k = (mode == MODE_PET) ? PET_KEYS[l] : l;
    uint32_t c = keyHeld[k] ? KEY_COLORS[k] : dimColor(KEY_COLORS[k], 0.35f);
    frame.fillRect(l * laneW + 1, HIT_Y + 3, laneW - 2, H - HIT_Y - 3, to565(c));
  }

  if (mode == MODE_SONG && song) {
    // y position = how many ms are left until the note must be played
    int32_t t = (int32_t)(now - songStartMs);
    for (uint16_t i = noteIdx; i < song->len; i++) {
      int32_t dt = (int32_t)noteTimeMs[i] - t;
      if (dt > FALL_MS) break;                                     // still above the screen
      int y = HIT_Y - dt * (HIT_Y - TOP) / FALL_MS;                                              //@display.note
      int len = max(4, (int)(song->notes[i].halfBeats * (HIT_Y - TOP) * 0.4f / 2));
      frame.fillRoundRect(song->notes[i].key * laneW + 3, y - len, laneW - 6, len, 3, to565(KEY_COLORS[song->notes[i].key]));
    }
  } else if (mode == MODE_SIMON || mode == MODE_PET) {
    frame.setTextDatum(MC_DATUM);
    frame.setTextColor(state == ST_INPUT ? TFT_YELLOW : TFT_WHITE);
    frame.drawString(state == ST_INPUT ? "YOUR TURN" : state == ST_WATCH ? "WATCH" : "", W / 2, 45, 4);
    for (uint8_t i = 0; i < seqLen; i++) {                         // progress dots
      bool done = (state == ST_INPUT) ? i < seqPos : state == ST_WON;
      frame.fillCircle(W / 2 - seqLen * 6 + i * 12 + 6, 80, 4, done ? to565(KEY_COLORS[seq[i]]) : TFT_DARKGREY);
    }
  }

  frame.drawFastHLine(0, HIT_Y, W, TFT_WHITE);                     // the hit line
  frame.setTextDatum(TL_DATUM);
  frame.setTextColor(TFT_ORANGE);
  frame.drawString(MODE_NAMES[mode], 2, 2, 1);
  frame.setTextDatum(TR_DATUM);
  frame.setTextColor(TFT_WHITE);
  char hud[32];
  snprintf(hud, sizeof hud, "treats %d/%d  %05lu", treatsToday, settings.dailyTreatLimit, score);
  frame.drawString(hud, W - 2, 2, 1);

  if (offerPending) {                    // a treat is waiting: tell the player what to do
    frame.fillRoundRect(30, 40, 180, 44, 8, TFT_ORANGE);
    frame.setTextDatum(MC_DATUM);
    frame.setTextColor(TFT_BLACK);
    frame.drawString("TREAT READY!", W / 2, 54, 2);
    frame.drawString("hold your hand under it", W / 2, 72, 2);                               //@display.offer
  }

  frame.pushSprite(0, 0);                // whole frame over SPI (40 MHz) in ≈ 7 ms              //@display.push
}
