# Audio clock and asset pipeline

The game always treats the Web Audio clock as authoritative. Render frames and
collision steps consume the same beat map, so a slow display frame cannot move
an obstacle off the music.

The checked-in build requests `/audio/<level-id>.mp3` and falls back to a
deterministic procedural score while final Suno masters are pending. The
conductor schedules drums, bass, hats, and the shared alarm motif directly
against `AudioContext.currentTime` when a master is unavailable, including
offline first runs.

When a final master is ready:

1. Lock the arrangement, bar count, and downbeat in Suno Studio.
2. Export 48 kHz WAV and stems.
3. Place the WAV in `audio/masters/<level-id>.wav`.
4. Run `npm run audio:prepare`.
5. Review the generated 256 kbps MP3, measured duration, and SHA-256.
6. Run the complete test suite and visually verify the first beat, every
   section boundary, and the ending.

If a track contains residual drift, replace the constant timestamps produced by
the current authoring data with measured beat timestamps. The public
`BeatMap` schema already supports nonuniform intervals.
