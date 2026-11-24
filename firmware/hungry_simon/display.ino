// ================================================================= display.ino: falling notes on the 2.8" ILI9341 (320×240)
// Each frame is drawn into a sprite (an off-screen frame buffer in RAM) and sent to the screen in
// one go, so the picture never flickers.
//
// Sending 320 × 240 pixels × 16 bits over SPI at 40 MHz takes ≈ 31 ms. If loop() did that itself,
// it could not read the keys for 31 ms, 25 times a second. So the display runs in its own FreeRTOS
// task on core 0, and loop() on core 1 keeps scanning keys at full speed. The task only READS the
// game state; it never changes it.
// Pins and driver are set in firmware/User_Setup_HungrySimon.h (TFT_eSPI): SCK 18, MOSI 23, CS 5, DC 4.

TFT_eSPI tft;
TFT_eSprite frame(&tft);

const int W = 320, H = 240, TOP = 22, HIT_Y = 212;

void displayBegin() {
  tft.init();
  tft.setRotation(1);                    // landscape, 320 wide
  frame.setColorDepth(8);                // 8-bit colour: 320 × 240 × 1 byte = 77 KB of RAM (16-bit would need 154 KB)
  frame.createSprite(W, H);
  xTaskCreatePinnedToCore(displayTask, "display", 4096, nullptr, 1, nullptr, 0);   // lower priority than audio
}

void displayOff() {
  tft.writecommand(ILI9341_DISPOFF);
  tft.writecommand(ILI9341_SLPIN);       // panel to sleep (the backlight is wired to 3.3 V)
}

void displayTask(void*) {
  for (;;) {
    uint32_t start = millis();
    displayDraw(start);
    int32_t wait = 40 - (int32_t)(millis() - start);   // aim for 25 frames per second (brief: ≥ 20)  //@display.rate
    vTaskDelay(pdMS_TO_TICKS(wait > 1 ? wait : 1));
  }
}

uint16_t to565(uint32_t c) { return tft.color565(c >> 16, (c >> 8) & 0xFF, c & 0xFF); }

void displayDraw(uint32_t now) {
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
      int len = max(6, (int)(song->notes[i].halfBeats * (HIT_Y - TOP) * 0.4f / 2));
      int lane = (mode == MODE_PET) ? song->notes[i].key / 2 : song->notes[i].key;
      frame.fillRoundRect(lane * laneW + 4, y - len, laneW - 8, len, 4, to565(KEY_COLORS[song->notes[i].key]));
    }
  } else if (mode == MODE_SIMON || mode == MODE_PET) {
    frame.setTextDatum(MC_DATUM);
    frame.setTextColor(state == ST_INPUT ? TFT_YELLOW : TFT_WHITE);
    frame.drawString(state == ST_INPUT ? "YOUR TURN" : state == ST_WATCH ? "WATCH" : "", W / 2, 80, 4);
    for (uint8_t i = 0; i < seqLen; i++) {                         // progress dots
      bool done = (state == ST_INPUT) ? i < seqPos : state == ST_WON;
      frame.fillCircle(W / 2 - seqLen * 8 + i * 16 + 8, 130, 6, done ? to565(KEY_COLORS[seq[i]]) : TFT_DARKGREY);
    }
  }

  frame.drawFastHLine(0, HIT_Y, W, TFT_WHITE);                     // the hit line
  frame.setTextDatum(TL_DATUM);
  frame.setTextColor(TFT_ORANGE);
  frame.drawString(MODE_NAMES[mode], 4, 4, 2);
  frame.setTextDatum(TR_DATUM);
  frame.setTextColor(TFT_WHITE);
  char hud[40];
  snprintf(hud, sizeof hud, "treats %d/%d   %05lu", treatsToday, settings.dailyTreatLimit, score);
  frame.drawString(hud, W - 4, 4, 2);

  if (offerPending) {                    // a treat is waiting: tell the player what to do
    frame.fillRoundRect(40, 75, 240, 74, 10, TFT_ORANGE);
    frame.setTextDatum(MC_DATUM);
    frame.setTextColor(TFT_BLACK);
    frame.drawString("TREAT READY!", W / 2, 100, 4);
    frame.drawString("hold your hand under the chute", W / 2, 130, 2);                       //@display.offer
  }

  frame.pushSprite(0, 0);                // whole frame over SPI (40 MHz) in ≈ 31 ms              //@display.push
}
