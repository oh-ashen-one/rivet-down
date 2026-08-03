# RIVET//DOWN

One input. Five failing systems.

RIVET//DOWN is an original industrial rhythm autorunner for the web and
desktop. The player controls a hexagonal maintenance drone through five
hand-authored factory levels. Obstacles, physics, procedural music, and visual
pulses share the same audio-clock-derived beat map.

[Play RIVET//DOWN in your browser](https://rivet-down.solashenone.chatgpt.site/)

## Current state

- Five complete level definitions from 128 to 180 BPM
- Runner, pressure-orb, polarity, and thruster mechanics
- Deterministic 120 Hz simulation and swept collision checks
- Audio-clock synchronization with latency calibration
- Normal and checkpoint-based Practice modes
- Three optional fuses per level and local progression
- Keyboard, pointer/touch, and controller input
- Accessibility controls and local save export/import
- Offline-capable PWA
- Developer timeline at `/?dev=1`

The build includes runtime edits of five Suno-generated tracks. Their prompts,
generation details, plan-at-generation evidence, durations, and SHA-256 hashes
are documented in `docs/SUNO_PROMPTS.md` and `music-provenance.json`. The music
is distributed under the separate source-available terms in
`LICENSE-MUSIC.md`; it is not covered by the MIT code license or the CC0 asset
dedication.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run typecheck
npm run test:unit
npm run build
npm run desktop:build:web
```

The Tauri 2 desktop shell lives in `src-tauri/`. With Rust installed, use
`npm run desktop:dev` or `npm run desktop:build` to produce native macOS,
Windows, and Linux artifacts from the same client bundle.

## Rebuilding the runtime audio

The checked-in MP3 files under `public/audio/` are runtime edits. To reproduce
them, place the paid-plan 48 kHz WAV masters in:

```text
audio/masters/cold-start.wav
audio/masters/pressure-line.wav
audio/masters/polarity-shaft.wav
audio/masters/turbine-blackout.wav
audio/masters/meltdown-zero.wav
```

Then run:

```bash
npm run audio:prepare
```

The script normalizes and encodes the runtime tracks, validates their expected
bar-derived duration, and records SHA-256 hashes.

## Licensing

- Code and documentation: MIT (`LICENSE`)
- Original art, level data, and synthesized SFX: CC0
  (`LICENSE-ASSETS.md`)
- Final Suno soundtrack: separate source-available terms
  (`LICENSE-MUSIC.md`)

The project deliberately contains no copied Geometry Dash art, UI, levels,
characters, or music.
