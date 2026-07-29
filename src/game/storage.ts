"use client";

import type { GameSave, GameSettings, LevelId } from "./types";

const SAVE_KEY = "rivetdown.save.v1";
const SETTINGS_KEY = "rivetdown.settings.v1";

export const defaultSettings: GameSettings = {
  musicVolume: 0,
  sfxVolume: 0,
  latencyMs: 0,
  reducedFlash: false,
  reducedMotion: false,
  highContrast: false,
  actionKey: "Space",
};

export const defaultSave: GameSave = {
  version: 1,
  unlockedLevel: 1,
  completed: {},
  bestAttempts: {},
  fuses: {},
  paletteIndex: 0,
};

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"),
    };
  } catch {
    return defaultSettings;
  }
}

export function storeSettings(settings: GameSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave(): GameSave {
  if (typeof window === "undefined") {
    return defaultSave;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}");
    return {
      ...defaultSave,
      ...parsed,
      completed: parsed.completed ?? {},
      bestAttempts: parsed.bestAttempts ?? {},
      fuses: parsed.fuses ?? {},
    };
  } catch {
    return defaultSave;
  }
}

export function storeSave(save: GameSave): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function recordCompletion(
  save: GameSave,
  levelId: LevelId,
  levelNumber: number,
  attempts: number,
  fuses: number[],
): GameSave {
  const existingFuses = new Set(save.fuses[levelId] ?? []);
  fuses.forEach((index) => existingFuses.add(index));
  const best = save.bestAttempts[levelId];
  const next: GameSave = {
    ...save,
    unlockedLevel: Math.max(save.unlockedLevel, Math.min(5, levelNumber + 1)),
    completed: { ...save.completed, [levelId]: true },
    bestAttempts: {
      ...save.bestAttempts,
      [levelId]: best === undefined ? attempts : Math.min(best, attempts),
    },
    fuses: {
      ...save.fuses,
      [levelId]: [...existingFuses].sort(),
    },
  };
  storeSave(next);
  return next;
}

export function exportProgress(save: GameSave, settings: GameSettings): void {
  const payload = {
    product: "RIVET//DOWN",
    exportedAt: new Date().toISOString(),
    save,
    settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "rivet-down-progress.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importProgress(
  file: File,
): Promise<{ save: GameSave; settings: GameSettings }> {
  const parsed = JSON.parse(await file.text());
  if (parsed?.product !== "RIVET//DOWN" || parsed?.save?.version !== 1) {
    throw new Error("That file is not a RIVET//DOWN v1 progress export.");
  }
  const save: GameSave = { ...defaultSave, ...parsed.save };
  const settings: GameSettings = {
    ...defaultSettings,
    ...(parsed.settings ?? {}),
  };
  storeSave(save);
  storeSettings(settings);
  return { save, settings };
}
