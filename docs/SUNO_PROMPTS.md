# RIVET//DOWN Suno production prompts

Generate every final candidate while a Pro or Premier subscription is active.
Use Instrumental mode. Do not reference named artists, existing songs, or other
games in the prompt.

Generate `Cold Start` first. After choosing its final alarm motif, use the
strongest eight-bar hook as a low-influence audio reference for tracks 2–5.
Suno can miss requested BPM or bar counts, so reject severe drift and correct
minor drift with Studio warp markers before export.

## 01 — Cold Start

> Instrumental only. Exactly 128 BPM, 4/4, constant tempo, 64 bars,
> approximately 2 minutes. Polished futuristic industrial electro with a crisp
> punchy kick on every quarter note, snare on beats 2 and 4, bright metallic
> percussion, compact analog bass, and a clean chiptune-like lead. Optimistic
> mechanical momentum, readable rhythm, and a memorable short alarm motif.
> Structure: 8-bar sparse calibration intro, 16-bar first movement, 8-bar
> breakdown, 16-bar stronger movement, 12-bar final escalation, 4-bar clean
> ending. Strong transient definition, no swing, no rubato, no tempo changes,
> no long ambience, no vocals, no spoken words, and no fade-out. Keep downbeats
> unmistakable and leave headroom for game sound effects.

## 02 — Pressure Line

> Instrumental only. Exactly 140 BPM, 4/4, constant tempo, 72 bars,
> approximately 2 minutes. High-quality industrial electro-house and controlled
> glitch bass, using hydraulic impacts, metallic clanks, compressed machine
> percussion, a firm four-on-the-floor kick, and a playful sharp synth hook.
> Reinterpret the provided alarm motif without copying the entire reference
> arrangement. Create clear eight-bar phrases with rising pressure, brief
> mechanical silences before drops, increasingly syncopated fills only at
> phrase endings, and a forceful final section. No vocals, no spoken samples,
> no swing, no tempo changes, no misleading downbeats, no ambient opening, and
> no fade-out. Crisp transients and enough sonic space for jump and collision
> effects.

## 03 — Polarity Shaft

> Instrumental only. Exactly 152 BPM, 4/4, constant tempo, 80 bars,
> approximately 2 minutes and 6 seconds. Dark polished industrial breakbeat and
> electro-bass with magnetic pulses, alternating high and low synth phrases,
> metallic arpeggios, tight sub bass, and sharply defined drums. Transform the
> provided alarm motif into an inverted call-and-response melody that suggests
> gravity reversing. Use stable downbeats, clean 8-bar and 16-bar sections, one
> controlled halftime-feeling breakdown without changing the actual tempo, two
> escalating drops, and a decisive four-bar ending. No vocals, no spoken words,
> no rubato, no real tempo changes, no fade-out, and no muddy reverb. Maintain a
> precise beat grid suitable for a rhythm platform game.

## 04 — Turbine Blackout

> Instrumental only. Exactly 168 BPM, 4/4, constant tempo, 88 bars,
> approximately 2 minutes and 6 seconds. Aggressive cinematic industrial drum
> and bass with turbine-like bass motion, precise breakbeats, rapid closed
> hi-hats, warning-siren synth accents, distorted machinery textures, and a
> powerful but clean low end. Reuse the provided alarm motif as a tense
> background signal rather than the main melody. Begin with an 8-bar restrained
> ignition, then build through clear gameplay phrases, a short blackout
> breakdown with audible pulse markers, and two increasingly dense drops. No
> vocals, no spoken samples, no tempo changes, no swing, no arrhythmic noise
> passages, no long risers, and no fade-out. Prioritize sharp transients and
> exact rhythmic readability over maximal loudness.

## 05 — Meltdown Zero

> Instrumental only. Exactly 180 BPM, 4/4, constant tempo, 96 bars,
> approximately 2 minutes and 8 seconds. Final-stage industrial electronic
> hybrid combining high-speed drum and bass, hard electro, controlled glitch
> percussion, reactor alarms, metallic impacts, and an urgent melodic lead.
> Reintroduce the provided alarm motif as a triumphant final hook, with
> recognizable transformations that feel like the culmination of a five-track
> soundtrack. Use an 8-bar warning intro, multiple clearly separated 16-bar
> gameplay movements, one short tension break that retains an audible
> quarter-note pulse, a massive final 28-bar escalation, and a clean four-bar
> stop. Intense but musically coherent; no vocals, no spoken words, no tempo
> changes, no fake tempo transitions, no unmetered section, no clipping, and no
> fade-out. Keep every downbeat and phrase boundary obvious for frame-accurate
> obstacle synchronization.

## Export checklist

1. Correct timing in Suno Studio before level authoring.
2. Export the full mix and available stems as 48 kHz WAV.
3. Preserve at least drums, bass, and melodic stems.
4. Place final mixes in `audio/masters/<level-id>.wav`.
5. Run `npm run audio:prepare`.
6. Record the Suno URL, generation date, plan confirmation, and selected model
   in `music-provenance.json`.
7. Commit web encodes only after their hashes and durations pass validation.
