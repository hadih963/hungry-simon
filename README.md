# Hungry Simon: interactive simulator

Browser simulator of **Hungry Simon**, an ESP32-based interactive rhythm instrument
(Project Group 9, ACS_1C 2026/2027, The Hague University of Applied Sciences).

The real device: 8 spring-loaded keys with an RGB LED under each, a speaker, a display above the keys
with falling notes (Guitar Hero style), a presence sensor that wakes it from deep sleep, and a servo
treat dispenser that rewards a completed sequence or song. It talks MQTT over TLS to a web app.

This simulator reproduces the behaviour so the team can demo it and test game logic before the
hardware is built.

## Run
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000.

Keyboard: `A S D F J K L ;` play the 8 keys (Do Re Mi Fa Sol La Si Do').

## Modes
- **Free play**: normal instrument.
- **Simon says**: repeat a growing light/sound sequence.
- **Song challenge**: play along with falling notes; easy / normal / hard.
- **Pet mode**: 4 large keys, short patterns.

## Team of models
See `AGENTS.md` for file ownership and the device-visuals contract.
