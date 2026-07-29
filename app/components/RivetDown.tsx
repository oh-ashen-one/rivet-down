"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RivetEngine } from "../../src/game/engine";
import { barBeatLabel } from "../../src/game/beat-map";
import { levels } from "../../src/game/levels";
import {
  defaultSave,
  defaultSettings,
  exportProgress,
  importProgress,
  loadSave,
  loadSettings,
  recordCompletion,
  storeSettings,
} from "../../src/game/storage";
import type {
  GameSave,
  GameSettings,
  InputReplay,
  LevelDefinition,
  RuntimeSnapshot,
} from "../../src/game/types";

const initialSnapshot: RuntimeSnapshot = {
  phase: "countdown",
  beat: 0,
  progress: 0,
  attempts: 1,
  fuses: [],
  checkpointBeat: 0,
};

interface StageProps {
  level: LevelDefinition;
  practice: boolean;
  settings: GameSettings;
  runKey: number;
  onSnapshot: (snapshot: RuntimeSnapshot) => void;
  onComplete: (
    attempts: number,
    fuses: number[],
    replay: InputReplay,
  ) => void;
  onEngine: (engine: RivetEngine | null) => void;
}

function GameStage({
  level,
  practice,
  settings,
  runKey,
  onSnapshot,
  onComplete,
  onEngine,
}: StageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RivetEngine | null>(null);
  const initialSettingsRef = useRef(settings);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }
    let cancelled = false;
    let activeEngine: RivetEngine | null = null;
    const mount = mountRef.current;
    void import("../../src/game/engine").then(({ RivetEngine }) => {
      if (cancelled) return;
      activeEngine = new RivetEngine(
        mount,
        level,
        practice,
        initialSettingsRef.current,
        {
          onSnapshot,
          onComplete,
        },
      );
      engineRef.current = activeEngine;
      onEngine(activeEngine);
      void activeEngine.initialize();
    });

    return () => {
      cancelled = true;
      onEngine(null);
      activeEngine?.destroy();
      engineRef.current = null;
    };
    // runKey deliberately reconstructs the deterministic run.
  }, [level, practice, runKey, onComplete, onEngine, onSnapshot]);

  useEffect(() => {
    engineRef.current?.updateSettings(settings);
  }, [settings]);

  return <div className="game-mount" ref={mountRef} data-testid="game-mount" />;
}

function FuseMarks({ active }: { active: number[] }) {
  return (
    <div className="fuse-marks" aria-label={`${active.length} of 3 fuses`}>
      {[0, 1, 2].map((index) => (
        <span
          className={active.includes(index) ? "fuse-mark is-active" : "fuse-mark"}
          key={index}
        />
      ))}
    </div>
  );
}

function SettingsPanel({
  settings,
  save,
  onSettings,
  onSave,
  onClose,
}: {
  settings: GameSettings;
  save: GameSave;
  onSettings: (settings: GameSettings) => void;
  onSave: (save: GameSave) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K],
  ) => {
    const next = { ...settings, [key]: value };
    storeSettings(next);
    onSettings(next);
  };

  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
      >
        <header className="panel-heading">
          <div>
            <p className="eyebrow">LOCAL SYSTEM</p>
            <h2 id="settings-heading">Calibration</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>

        <label className="range-row">
          <span>Music</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.musicVolume}
            onChange={(event) => update("musicVolume", Number(event.target.value))}
          />
          <output>{Math.round(settings.musicVolume * 100)}</output>
        </label>
        <label className="range-row">
          <span>SFX</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.sfxVolume}
            onChange={(event) => update("sfxVolume", Number(event.target.value))}
          />
          <output>{Math.round(settings.sfxVolume * 100)}</output>
        </label>
        <label className="range-row">
          <span>Audio offset</span>
          <input
            type="range"
            min="-200"
            max="500"
            step="5"
            value={settings.latencyMs}
            onChange={(event) => update("latencyMs", Number(event.target.value))}
          />
          <output>{settings.latencyMs}ms</output>
        </label>

        <div className="toggle-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.reducedFlash}
              onChange={(event) => update("reducedFlash", event.target.checked)}
            />
            <span>Reduced flashes</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => update("reducedMotion", event.target.checked)}
            />
            <span>Reduced motion</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(event) => update("highContrast", event.target.checked)}
            />
            <span>High-contrast hazards</span>
          </label>
        </div>

        <label className="select-row">
          <span>Action key</span>
          <select
            value={settings.actionKey}
            onChange={(event) => update("actionKey", event.target.value)}
          >
            <option value="Space">Space</option>
            <option value="KeyZ">Z</option>
            <option value="KeyX">X</option>
            <option value="Enter">Enter</option>
          </select>
        </label>

        <div className="data-actions">
          <button
            className="secondary-button"
            onClick={() => exportProgress(save, settings)}
          >
            Export progress
          </button>
          <button
            className="secondary-button"
            onClick={() => fileRef.current?.click()}
          >
            Import progress
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const imported = await importProgress(file);
                onSave(imported.save);
                onSettings(imported.settings);
              } catch (error) {
                window.alert(
                  error instanceof Error ? error.message : "Import failed.",
                );
              }
            }}
          />
        </div>
        <p className="settings-note">
          Positive audio offset delays the visuals to compensate for Bluetooth
          playback latency. Progress never leaves this device unless you export it.
        </p>
      </section>
    </div>
  );
}

export default function RivetDown() {
  const [hydrated, setHydrated] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [save, setSave] = useState<GameSave>(defaultSave);
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [selectedLevel, setSelectedLevel] = useState<LevelDefinition | null>(null);
  const [practice, setPractice] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(initialSnapshot);
  const [engine, setEngine] = useState<RivetEngine | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [lastReplay, setLastReplay] = useState<InputReplay | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSave(loadSave());
      const mutedSettings = {
        ...loadSettings(),
        musicVolume: 0,
        sfxVolume: 0,
      };
      storeSettings(mutedSettings);
      setSettings(mutedSettings);
      setDevMode(new URLSearchParams(window.location.search).has("dev"));
      setHydrated(true);
      if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/sw.js");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedLevel]);

  const complete = useCallback(
    (attempts: number, fuses: number[], replay: InputReplay) => {
      if (!selectedLevel) return;
      setLastReplay(replay);
      if (!practice) {
        setSave((current) =>
          recordCompletion(
            current,
            selectedLevel.id,
            selectedLevel.number,
            attempts,
            fuses,
          ),
        );
      }
    },
    [practice, selectedLevel],
  );

  if (!hydrated) {
    return (
      <main className="boot-screen">
        <p className="eyebrow">RIVET SYSTEMS</p>
        <h1>SYNCING LINE…</h1>
      </main>
    );
  }

  if (selectedLevel) {
    return (
      <main
        className="play-shell"
        style={
          {
            "--level-accent": `#${selectedLevel.palette.accent
              .toString(16)
              .padStart(6, "0")}`,
          } as React.CSSProperties
        }
      >
        <header className="play-header">
          <button
            className="back-button"
            onClick={() => setSelectedLevel(null)}
            aria-label="Return to level select"
          >
            ← ABORT
          </button>
          <div className="play-title">
            <span>0{selectedLevel.number}</span>
            <div>
              <strong>{selectedLevel.title}</strong>
              <small>{selectedLevel.bpm} BPM · {selectedLevel.subtitle}</small>
            </div>
          </div>
          <div className="play-tools">
            {practice && <span className="practice-chip">PRACTICE</span>}
            <button className="icon-button" onClick={() => void engine?.togglePause()}>
              {snapshot.phase === "paused" ? "▶" : "Ⅱ"}
              <span className="sr-only">Toggle pause</span>
            </button>
            <button className="icon-button" onClick={() => setSettingsOpen(true)}>
              ⚙
              <span className="sr-only">Open settings</span>
            </button>
          </div>
        </header>

        <section className="game-frame" aria-label={`${selectedLevel.title} game`}>
          <div className="hud-top">
            <div className="attempt-readout">
              <span>ATTEMPT</span>
              <strong>{snapshot.attempts.toString().padStart(3, "0")}</strong>
            </div>
            <div className="beat-readout">
              <span>BAR:BEAT</span>
              <strong>{barBeatLabel(snapshot.beat)}</strong>
            </div>
            <FuseMarks active={snapshot.fuses} />
          </div>
          <GameStage
            level={selectedLevel}
            practice={practice}
            settings={settings}
            runKey={runKey}
            onSnapshot={setSnapshot}
            onComplete={complete}
            onEngine={setEngine}
          />
          <div className="progress-track" aria-hidden="true">
            <span style={{ transform: `scaleX(${snapshot.progress})` }} />
          </div>
          {(snapshot.phase === "countdown" ||
            snapshot.phase === "dead" ||
            snapshot.phase === "paused") && (
            <div className={`status-burst status-${snapshot.phase}`}>
              <span>{snapshot.message ?? snapshot.phase.toUpperCase()}</span>
            </div>
          )}
          {snapshot.phase === "complete" && (
            <div className="completion-card">
              <p className="eyebrow">LINE SURVIVED</p>
              <h2>{practice ? "Practice complete" : "Clear confirmed"}</h2>
              <div className="completion-stats">
                <span>
                  Attempts <strong>{snapshot.attempts}</strong>
                </span>
                <span>
                  Fuses <strong>{snapshot.fuses.length}/3</strong>
                </span>
                <span>
                  Inputs <strong>{lastReplay?.actions.length ?? 0}</strong>
                </span>
              </div>
              <div className="completion-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    setSnapshot(initialSnapshot);
                    setRunKey((value) => value + 1);
                  }}
                >
                  Run again
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedLevel(null)}
                >
                  Level select
                </button>
              </div>
            </div>
          )}
          {devMode && (
            <aside className="dev-timeline" aria-label="Developer timeline">
              <span>DEV · {barBeatLabel(snapshot.beat)}</span>
              <input
                aria-label="Seek timeline"
                type="range"
                min="0"
                max={selectedLevel.bars * 4 - 1}
                step="0.25"
                value={Math.min(snapshot.beat, selectedLevel.bars * 4 - 1)}
                onChange={(event) =>
                  void engine?.seekToBeat(Number(event.target.value))
                }
              />
              <small>
                {
                  selectedLevel.events.filter(
                    (item) =>
                      item.beat >= snapshot.beat &&
                      item.beat < snapshot.beat + 4,
                  ).length
                }{" "}
                events in next bar
              </small>
            </aside>
          )}
        </section>
        <footer className="control-strip">
          <span>
            <kbd>{settings.actionKey === "Space" ? "SPACE" : settings.actionKey.replace("Key", "")}</kbd>
            TAP / HOLD
          </span>
          <span><kbd>P</kbd> PAUSE</span>
          <span className="score-status">SUNO MASTER · AUDIO-CLOCK SYNC</span>
        </footer>
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            save={save}
            onSettings={setSettings}
            onSave={setSave}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="menu-shell">
      <div className="factory-grid" aria-hidden="true" />
      <header className="menu-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <div>
            <p className="eyebrow">OPEN FACTORY PROTOCOL</p>
            <h1>RIVET<span>{"//"}</span>DOWN</h1>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setSettingsOpen(true)}>
            Calibration
          </button>
          <span className="github-link">SOURCE READY</span>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">ONE INPUT. FIVE FAILING SYSTEMS.</p>
          <h2>Descend on beat.<br />Break beautifully.</h2>
        </div>
        <p>
          A precision industrial rhythm run. Every obstacle is locked to the
          audio clock. Every death is yours. Restart before the anger cools.
        </p>
      </section>

      <section className="level-section" aria-labelledby="levels-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CAMPAIGN</p>
            <h2 id="levels-heading">Factory descent</h2>
          </div>
          <label className="practice-toggle">
            <input
              type="checkbox"
              checked={practice}
              onChange={(event) => setPractice(event.target.checked)}
            />
            <span>Practice checkpoints</span>
          </label>
        </div>
        <div className="level-grid">
          {levels.map((level) => {
            const locked =
              !practice && !devMode && level.number > save.unlockedLevel;
            const completed = Boolean(save.completed[level.id]);
            const fuses = save.fuses[level.id] ?? [];
            return (
              <article
                className={`level-card ${locked ? "is-locked" : ""}`}
                key={level.id}
                style={
                  {
                    "--card-accent": `#${level.palette.accent
                      .toString(16)
                      .padStart(6, "0")}`,
                    "--card-dark": `#${level.palette.background
                      .toString(16)
                      .padStart(6, "0")}`,
                  } as React.CSSProperties
                }
              >
                <div className="card-scan" aria-hidden="true" />
                <header>
                  <span className="level-number">0{level.number}</span>
                  <div className="difficulty-pips" aria-label={`${level.difficulty} of 5 difficulty`}>
                    {[1, 2, 3, 4, 5].map((pip) => (
                      <i key={pip} className={pip <= level.difficulty ? "is-on" : ""} />
                    ))}
                  </div>
                </header>
                <div className="card-core">
                  <span className="mechanic-tag">{level.mechanicLabel}</span>
                  <h3>{level.title}</h3>
                  <p>{level.description}</p>
                </div>
                <dl>
                  <div><dt>Tempo</dt><dd>{level.bpm}</dd></div>
                  <div><dt>Bars</dt><dd>{level.bars}</dd></div>
                  <div><dt>Best</dt><dd>{save.bestAttempts[level.id] ?? "—"}</dd></div>
                </dl>
                <footer>
                  <FuseMarks active={fuses} />
                  <button
                    className="card-launch"
                    disabled={locked}
                    onClick={() => {
                      setSnapshot(initialSnapshot);
                      setSelectedLevel(level);
                    }}
                  >
                    {locked ? "LOCKED" : completed ? "RUN AGAIN →" : "ENGAGE →"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="menu-footer">
        <span>NO ACCOUNTS</span>
        <span>NO TELEMETRY</span>
        <span>OFFLINE AFTER LOAD</span>
        <span>MIT ENGINE · OPEN ASSETS</span>
      </footer>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          save={save}
          onSettings={setSettings}
          onSave={setSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
