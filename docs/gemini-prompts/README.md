# Prompts for Gemini

Gemini isn't connected to this workspace yet, so Hadi runs these by hand.

How to use:
1. Open a prompt file, copy everything under **Prompt**, and paste it into Gemini.
   If a prompt says "attach", also upload the files it lists (or paste their contents).
2. Save Gemini's answer as the file named in **Save the answer as** (in `docs/gemini-output/`).
3. Upload it here or commit it on a branch named `gemini/<topic>`. Claude reviews it and merges it.

| # | Prompt | Output |
|---|---|---|
| 1 | [Hardware design and GPIO budget](01-hardware-design.md) | `docs/gemini-output/01-hardware-design.md` |
| 2 | [MQTT and cloud architecture](02-mqtt-cloud.md) | `docs/gemini-output/02-mqtt-cloud.md` |
| 3 | [Review of the game logic](03-review-game-logic.md) | `docs/gemini-output/03-review-game-logic.md` |
