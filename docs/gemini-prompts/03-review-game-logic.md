# 3. Review of the game logic

**Attach:** `src/core/game.js`, `src/core/songs.js`, `src/core/notes.js`, `src/main.js` from the repo, and the assignment PDF

**Save the answer as:** `docs/gemini-output/03-review-game-logic.md`

## Prompt

You are reviewing code written by another AI (Claude) for **Hungry Simon**, a browser simulator of
an ESP32 rhythm instrument. The attached `game.js` holds the logic for four modes:
- Free play: a normal instrument.
- Simon says: repeat a growing sequence.
- Song challenge: falling notes, with a timing window and difficulty levels.
- Pet mode: 4 big keys and short patterns.

The assignment PDF lists the required behaviour.

Please give:
1. **Requirement check**: for every bullet in sections 3 (Feedback & interaction) and 4 (Modes &
   safety) of the assignment, say whether the code meets it (✅ / ⚠️ / ❌), with the line or
   function and a one-line reason.
2. **Bugs**: concrete defects only, each with a scenario that triggers it (inputs → wrong
   behaviour) and a suggested fix. Look especially at timer handling when modes change quickly,
   the song timing window (early/late/missed), pet-mode key mapping, and what happens when a key is
   held during a mode switch or sleep.
3. **Porting to the ESP32 in C**: which parts carry over directly, which must change
   (`setTimeout` → FreeRTOS timers or a millis() state machine, Web Audio → LEDC `tone()`/I2S), and
   a sketch of the C struct + state enum that would replace the `Game` class.
4. **Suggestions** to make the game more fun or fair (max 5 bullet points).

Be specific and brief. Don't rewrite the whole file.
