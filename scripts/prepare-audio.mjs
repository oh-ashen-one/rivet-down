import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const provenancePath = resolve(root, "music-provenance.json");
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const outputDirectory = resolve(root, "public", "audio");
mkdirSync(outputDirectory, { recursive: true });

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

let prepared = 0;
for (const track of provenance.tracks) {
  const master = resolve(root, "audio", "masters", `${track.levelId}.wav`);
  const output = resolve(outputDirectory, `${track.levelId}.mp3`);
  if (!existsSync(master)) {
    console.log(`pending: ${track.levelId}`);
    continue;
  }

  const expectedDuration = (track.bars * 4 * 60) / track.bpm;
  const masterDuration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        master,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      master,
      "-t",
      expectedDuration.toFixed(6),
      "-ar",
      "48000",
      "-ac",
      "2",
      "-af",
      "loudnorm=I=-14:TP=-1:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "256k",
      output,
    ],
    { stdio: "inherit" },
  );

  const duration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        output,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  if (Math.abs(duration - expectedDuration) > 0.25) {
    throw new Error(
      `${track.levelId}: duration ${duration.toFixed(3)}s differs from expected ${expectedDuration.toFixed(3)}s`,
    );
  }

  track.masterSha256 = sha256(master);
  track.runtimeSha256 = sha256(output);
  track.masterDurationSeconds = masterDuration;
  track.durationSeconds = duration;
  track.runtimeEdit =
    masterDuration < expectedDuration
      ? "looped-to-level-duration"
      : masterDuration > expectedDuration
        ? "trimmed-to-level-duration"
        : "duration-unchanged";
  prepared += 1;
}

provenance.status =
  prepared === provenance.tracks.length
    ? "runtime-audio-prepared"
    : "suno-masters-pending";
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`prepared ${prepared}/${provenance.tracks.length} tracks`);
