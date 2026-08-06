"use client";

import { Application, Container, Graphics } from "pixi.js";
import { RhythmConductor } from "./audio";
import { beatToSeconds, secondsToBeat } from "./beat-map";
import {
  segmentPointDistanceSquared,
  sweptAabbIntersects,
} from "./collision";
import {
  BLOCK_WIDTH,
  FLOOR_Y,
  GRAVITY,
  JUMP_IMPULSE,
  PIXELS_PER_BEAT,
  PLAYER_SIZE,
} from "./tuning";
import type {
  GameSettings,
  InputReplay,
  LevelDefinition,
  LevelEvent,
  MechanicMode,
  RuntimeSnapshot,
} from "./types";

const WIDTH = 1440;
const HEIGHT = 810;
const PLAYER_X = 300;
const CEILING_Y = 145;
const FIXED_STEP = 1 / 120;
const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;

interface EngineCallbacks {
  onSnapshot: (snapshot: RuntimeSnapshot) => void;
  onComplete: (attempts: number, fuses: number[], replay: InputReplay) => void;
}

export class RivetEngine {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly backdrop = new Graphics();
  private readonly geometry = new Graphics();
  private readonly player = new Graphics();
  private readonly particles = new Graphics();
  private readonly conductor: RhythmConductor;
  private readonly consumed = new Set<string>();
  private readonly replay: InputReplay;
  private settings: GameSettings;
  private phase: RuntimeSnapshot["phase"] = "countdown";
  private playerY = FLOOR_Y - PLAYER_SIZE / 2;
  private velocityY = 0;
  private gravity: 1 | -1 = 1;
  private mode: MechanicMode = "runner";
  private grounded = true;
  private lastGroundedTime = 0;
  private jumpBufferedUntil = Number.NEGATIVE_INFINITY;
  private actionHeld = false;
  private gamepadActionHeld = false;
  private simTime = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private currentBeat = 0;
  private attempts = 1;
  private collectedFuses = new Set<number>();
  private checkpointBeat = 0;
  private countdownUntil = 0;
  private lastSnapshotAt = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private shake = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly level: LevelDefinition,
    private readonly practice: boolean,
    settings: GameSettings,
    private readonly callbacks: EngineCallbacks,
  ) {
    this.settings = settings;
    this.conductor = new RhythmConductor(level, settings);
    this.replay = {
      version: 1,
      levelId: level.id,
      bpm: level.bpm,
      actions: [],
    };
  }

  async initialize(): Promise<void> {
    await this.app.init({
      width: WIDTH,
      height: HEIGHT,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundAlpha: 0,
      preference: "webgl",
    });
    if (this.destroyed) {
      return;
    }

    this.app.canvas.className = "game-canvas";
    this.app.canvas.setAttribute(
      "aria-label",
      `${this.level.title} rhythm platforming playfield`,
    );
    this.app.canvas.tabIndex = 0;
    this.mount.replaceChildren(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.world.addChild(
      this.backdrop,
      this.geometry,
      this.player,
      this.particles,
    );
    await this.conductor.preload();
    this.attachInputs();
    this.drawPlayer();
    this.lastFrame = performance.now();
    this.app.ticker.add(this.frame);
    await this.startAt(0, 4);
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
    this.conductor.updateSettings(settings);
  }

  async togglePause(): Promise<void> {
    if (this.phase === "playing" || this.phase === "countdown") {
      this.conductor.pause();
      this.phase = "paused";
      this.emitSnapshot(true, "SYSTEM PAUSED");
      return;
    }
    if (this.phase === "paused") {
      this.phase = "countdown";
      this.countdownUntil =
        performance.now() + (2 * 60 * 1000) / this.level.bpm;
      await this.conductor.resume(2);
      this.emitSnapshot(true, "RE-SYNC");
    }
  }

  async restartFromBeginning(): Promise<void> {
    this.attempts += 1;
    this.collectedFuses.clear();
    await this.startAt(0, 2);
  }

  async seekToBeat(beat: number): Promise<void> {
    const maximum = this.level.bars * 4 - 1;
    const safeBeat = Math.max(0, Math.min(maximum, beat));
    this.checkpointBeat = safeBeat;
    await this.startAt(safeBeat, 1);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }
    this.detachInputs();
    this.app.ticker.remove(this.frame);
    this.conductor.destroy();
    this.app.destroy(true, { children: true });
  }

  private readonly frame = (): void => {
    if (this.destroyed) {
      return;
    }
    const now = performance.now();
    const elapsed = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.conductor.tick();
    this.pollGamepad();

    if (this.phase === "countdown" && now >= this.countdownUntil) {
      this.phase = "playing";
      this.lastFrame = now;
    }

    if (this.phase === "playing") {
      const targetTime = this.conductor.positionSeconds();
      this.accumulator += elapsed;
      let steps = 0;
      while (
        this.simTime + FIXED_STEP <= targetTime &&
        this.accumulator >= FIXED_STEP &&
        steps < 16
      ) {
        this.simTime += FIXED_STEP;
        this.accumulator -= FIXED_STEP;
        this.simulate(FIXED_STEP);
        steps += 1;
      }
      if (targetTime - this.simTime > 0.18) {
        this.simTime = targetTime;
        this.accumulator = 0;
      }
    }

    this.renderWorld();
    this.emitSnapshot(false);
  };

  private simulate(dt: number): void {
    const previousBeat = this.currentBeat;
    const previousPlayerY = this.playerY;
    this.currentBeat = secondsToBeat(this.level.beatMap, this.simTime);
    this.applyPassEvents();

    let acceleration = GRAVITY * this.gravity;
    if (this.mode === "thruster" && this.actionHeld) {
      acceleration -= 4800 * this.gravity;
    }
    this.velocityY += acceleration * dt;
    this.velocityY = Math.max(-1350, Math.min(1350, this.velocityY));
    this.playerY += this.velocityY * dt;
    this.grounded = false;

    const gap = this.activeGap();
    if (this.gravity === 1 && !gap) {
      const floorPosition = FLOOR_Y - PLAYER_SIZE / 2;
      if (this.playerY >= floorPosition && this.velocityY >= 0) {
        this.playerY = floorPosition;
        this.velocityY = 0;
        this.grounded = true;
      }
    }
    if (this.gravity === -1) {
      const ceilingPosition = CEILING_Y + PLAYER_SIZE / 2;
      if (this.playerY <= ceilingPosition && this.velocityY <= 0) {
        this.playerY = ceilingPosition;
        this.velocityY = 0;
        this.grounded = true;
      }
    }

    this.applyPads();
    if (
      this.mode === "runner" &&
      this.grounded &&
      this.simTime <= this.jumpBufferedUntil
    ) {
      this.performRunnerJump();
    }
    if (this.grounded) {
      this.lastGroundedTime = this.simTime;
    }
    this.applyCollectibles();
    this.checkHazardCollisions(previousBeat, previousPlayerY);

    if (
      this.playerY > HEIGHT + PLAYER_SIZE ||
      this.playerY < -PLAYER_SIZE
    ) {
      this.die("THE FLOOR WAS OPTIONAL");
      return;
    }

    if (this.currentBeat >= this.level.bars * 4 - 0.1) {
      this.complete();
    }
  }

  private applyPassEvents(): void {
    for (const item of this.level.events) {
      if (item.beat > this.currentBeat + 0.03) {
        break;
      }
      if (this.consumed.has(item.id)) {
        continue;
      }
      if (item.type === "gate") {
        this.consumed.add(item.id);
        if (item.targetMode) {
          this.mode = item.targetMode;
        }
        if (item.gravity) {
          this.gravity = item.gravity;
          this.velocityY = this.gravity * 160;
        }
        this.shake = this.settings.reducedMotion ? 0 : 8;
      }
      if (
        this.practice &&
        item.type === "checkpoint" &&
        item.beat <= this.currentBeat
      ) {
        this.checkpointBeat = item.beat;
        this.consumed.add(item.id);
      }
    }
  }

  private applyPads(): void {
    for (const item of this.level.events) {
      if (item.type !== "pad" || this.consumed.has(item.id)) {
        continue;
      }
      if (Math.abs(item.beat - this.currentBeat) < 0.16 && this.grounded) {
        this.consumed.add(item.id);
        this.velocityY = -JUMP_IMPULSE * 1.16 * this.gravity;
        this.grounded = false;
        this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
        this.conductor.orb();
        this.shake = this.settings.reducedMotion ? 0 : 4;
      }
    }
  }

  private applyCollectibles(): void {
    if (this.practice) {
      return;
    }
    for (const item of this.level.events) {
      if (
        item.type !== "fuse" ||
        item.fuseIndex === undefined ||
        this.collectedFuses.has(item.fuseIndex)
      ) {
        continue;
      }
      const x = this.eventX(item);
      const y = item.y ?? 410;
      if (
        Math.abs(x - PLAYER_X) < 46 &&
        Math.abs(y - this.playerY) < 58
      ) {
        this.collectedFuses.add(item.fuseIndex);
        this.consumed.add(item.id);
        this.conductor.fuse();
        this.shake = this.settings.reducedMotion ? 0 : 7;
        this.emitSnapshot(true, "FUSE ACQUIRED");
      }
    }
  }

  private activeGap(): LevelEvent | undefined {
    return this.level.events.find(
      (item) =>
        item.type === "gap" &&
        this.currentBeat >= item.beat - 0.2 &&
        this.currentBeat <= item.beat + (item.widthBeats ?? 1),
    );
  }

  private checkHazardCollisions(
    previousBeat: number,
    previousPlayerY: number,
  ): void {
    const playerHalf = PLAYER_SIZE * 0.39;
    const playerStart = {
      x: PLAYER_X - playerHalf,
      y: previousPlayerY - playerHalf,
      width: playerHalf * 2,
      height: playerHalf * 2,
    };
    const playerEnd = {
      x: PLAYER_X - playerHalf,
      y: this.playerY - playerHalf,
      width: playerHalf * 2,
      height: playerHalf * 2,
    };

    for (const item of this.visibleEvents()) {
      const x = this.eventX(item);
      const previousX =
        PLAYER_X + (item.beat - previousBeat) * PIXELS_PER_BEAT;
      if (item.type === "spike" || item.type === "ceiling-spike") {
        const width = 58;
        const height = 66;
        const top =
          item.type === "spike" ? FLOOR_Y - height * 0.78 : CEILING_Y;
        const bottom =
          item.type === "spike" ? FLOOR_Y : CEILING_Y + height * 0.78;
        const collisionWidth = width * 0.68;
        const obstacleStart = {
          x: previousX - collisionWidth / 2,
          y: top,
          width: collisionWidth,
          height: bottom - top,
        };
        const obstacleEnd = {
          ...obstacleStart,
          x: x - collisionWidth / 2,
        };
        if (sweptAabbIntersects(playerStart, playerEnd, obstacleStart, obstacleEnd)) {
          this.die("TOOTH MEETS RIVET");
          return;
        }
      }

      if (item.type === "block") {
        const rect = this.blockRect(item, x);
        const previousRect = this.blockRect(item, previousX);
        if (sweptAabbIntersects(playerStart, playerEnd, previousRect, rect)) {
          this.die("PRESSURE EXCEEDED");
          return;
        }
      }

      if (item.type === "saw") {
        const y = item.y ?? (item.lane === "ceiling" ? 270 : 535);
        const distanceSquared = segmentPointDistanceSquared(
          PLAYER_X - previousX,
          previousPlayerY - y,
          PLAYER_X - x,
          this.playerY - y,
          0,
          0,
        );
        if (distanceSquared < 48 * 48) {
          this.die("TURBINE CLAIMED");
          return;
        }
      }
    }
  }

  private handlePress = (): void => {
    if (this.phase !== "playing") {
      return;
    }
    this.actionHeld = true;
    this.replay.actions.push({ beat: this.currentBeat, kind: "press" });

    if (this.mode === "polarity") {
      this.gravity = this.gravity === 1 ? -1 : 1;
      this.velocityY = this.gravity * 460;
      this.grounded = false;
      this.conductor.orb();
      this.shake = this.settings.reducedMotion ? 0 : 5;
      return;
    }

    const orb = this.level.events.find(
      (item) =>
        item.type === "orb" &&
        !this.consumed.has(item.id) &&
        Math.abs(item.beat - this.currentBeat) <= 0.42 &&
        Math.abs((item.y ?? 405) - this.playerY) < 125,
    );
    if (orb) {
      this.consumed.add(orb.id);
      this.velocityY = -JUMP_IMPULSE * 1.05 * this.gravity;
      this.grounded = false;
      this.conductor.orb();
      this.shake = this.settings.reducedMotion ? 0 : 5;
      return;
    }

    if (this.mode === "runner") {
      const withinCoyoteWindow =
        this.simTime - this.lastGroundedTime <= COYOTE_TIME_SECONDS;
      if (this.grounded || withinCoyoteWindow) {
        this.performRunnerJump();
      } else {
        this.jumpBufferedUntil = this.simTime + JUMP_BUFFER_SECONDS;
      }
    }
  };

  private performRunnerJump(): void {
    this.velocityY = -JUMP_IMPULSE * this.gravity;
    this.grounded = false;
    this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
    this.conductor.jump();
  }

  private handleRelease = (): void => {
    if (this.phase !== "playing") {
      return;
    }
    this.actionHeld = false;
    this.replay.actions.push({ beat: this.currentBeat, kind: "release" });
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape" || event.code === "KeyP") {
      event.preventDefault();
      void this.togglePause();
      return;
    }
    if (
      event.code === this.settings.actionKey ||
      event.code === "ArrowUp" ||
      event.code === "KeyW"
    ) {
      event.preventDefault();
      if (!event.repeat) {
        this.handlePress();
      }
    }
  };

  private readonly keyUp = (event: KeyboardEvent): void => {
    if (
      event.code === this.settings.actionKey ||
      event.code === "ArrowUp" ||
      event.code === "KeyW"
    ) {
      event.preventDefault();
      this.handleRelease();
    }
  };

  private readonly pointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.handlePress();
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    event.preventDefault();
    this.handleRelease();
  };

  private readonly visibilityChange = (): void => {
    if (document.hidden && (this.phase === "playing" || this.phase === "countdown")) {
      void this.togglePause();
    }
  };

  private attachInputs(): void {
    window.addEventListener("keydown", this.keyDown, { passive: false });
    window.addEventListener("keyup", this.keyUp, { passive: false });
    this.app.canvas.addEventListener("pointerdown", this.pointerDown, {
      passive: false,
    });
    window.addEventListener("pointerup", this.pointerUp, { passive: false });
    document.addEventListener("visibilitychange", this.visibilityChange);
  }

  private detachInputs(): void {
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.app.canvas.removeEventListener("pointerdown", this.pointerDown);
    window.removeEventListener("pointerup", this.pointerUp);
    document.removeEventListener("visibilitychange", this.visibilityChange);
  }

  private die(message: string): void {
    if (this.phase !== "playing") {
      return;
    }
    this.phase = "dead";
    this.conductor.pause();
    this.conductor.death();
    this.shake = this.settings.reducedMotion ? 0 : 18;
    this.drawDeathBurst();
    this.emitSnapshot(true, message);

    const restartBeat = this.practice ? this.checkpointBeat : 0;
    if (!this.practice) {
      this.attempts += 1;
      this.collectedFuses.clear();
    }
    this.restartTimer = setTimeout(() => {
      void this.startAt(restartBeat, this.practice ? 4 : 0);
    }, 430);
  }

  private complete(): void {
    if (this.phase !== "playing") {
      return;
    }
    this.phase = "complete";
    this.conductor.pause();
    this.emitSnapshot(true, "LINE SURVIVED");
    this.callbacks.onComplete(
      this.attempts,
      [...this.collectedFuses].sort(),
      structuredClone(this.replay),
    );
  }

  private async startAt(beat: number, countInBeats: number): Promise<void> {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.consumed.clear();
    let restoredMode: MechanicMode = "runner";
    let restoredGravity: 1 | -1 = 1;
    for (const item of this.level.events) {
      if (item.beat < beat && item.type !== "fuse") {
        this.consumed.add(item.id);
        if (item.type === "gate") {
          restoredMode = item.targetMode ?? restoredMode;
          restoredGravity = item.gravity ?? restoredGravity;
        }
      }
    }
    this.currentBeat = beat;
    this.simTime = beatToSeconds(this.level.beatMap, beat);
    this.accumulator = 0;
    this.playerY =
      restoredMode === "thruster"
        ? (FLOOR_Y + CEILING_Y) / 2
        : restoredGravity === 1
          ? FLOOR_Y - PLAYER_SIZE / 2
          : CEILING_Y + PLAYER_SIZE / 2;
    this.velocityY = 0;
    this.gravity = restoredGravity;
    this.mode = restoredMode;
    this.grounded = restoredMode !== "thruster";
    this.lastGroundedTime = this.simTime;
    this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
    this.actionHeld = false;
    this.particles.clear();
    this.phase = "countdown";
    this.countdownUntil =
      performance.now() + (countInBeats * 60 * 1000) / this.level.bpm;
    await this.conductor.seek(this.simTime, countInBeats);
    this.emitSnapshot(true, this.practice ? "PRACTICE SYNC" : "SYSTEM ARMED");
  }

  private renderWorld(): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.currentBeat * Math.PI * 2);
    const palette = this.level.palette;
    const flashAlpha = this.settings.reducedFlash ? 0.035 : 0.08 + pulse * 0.05;

    this.backdrop
      .clear()
      .rect(0, 0, WIDTH, HEIGHT)
      .fill({ color: palette.background });

    const gridOffset = ((this.currentBeat % 1) * PIXELS_PER_BEAT) % PIXELS_PER_BEAT;
    for (let x = -gridOffset; x < WIDTH; x += PIXELS_PER_BEAT) {
      this.backdrop
        .moveTo(x, CEILING_Y)
        .lineTo(x, FLOOR_Y)
        .stroke({ color: palette.accentSoft, width: 2, alpha: 0.16 });
    }
    for (let y = CEILING_Y; y <= FLOOR_Y; y += 65) {
      this.backdrop
        .moveTo(0, y)
        .lineTo(WIDTH, y)
        .stroke({ color: palette.accentSoft, width: 1, alpha: 0.09 });
    }
    this.backdrop
      .rect(0, 0, WIDTH, HEIGHT)
      .fill({ color: palette.accent, alpha: flashAlpha });

    this.geometry.clear();
    this.geometry
      .rect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y)
      .fill({ color: palette.backgroundAlt, alpha: 0.96 })
      .rect(0, CEILING_Y - 24, WIDTH, 24)
      .fill({ color: palette.backgroundAlt, alpha: 0.96 })
      .moveTo(0, FLOOR_Y)
      .lineTo(WIDTH, FLOOR_Y)
      .stroke({ color: palette.accent, width: 5, alpha: 0.75 })
      .moveTo(0, CEILING_Y)
      .lineTo(WIDTH, CEILING_Y)
      .stroke({ color: palette.accent, width: 4, alpha: 0.42 });

    for (const item of this.visibleEvents()) {
      this.drawEvent(item, pulse);
    }

    this.drawPlayer();
    this.player.rotation +=
      this.phase === "playing" && this.mode === "runner"
        ? 0.06 * this.gravity
        : 0;
    this.player.position.set(PLAYER_X, this.playerY);

    if (this.shake > 0.1 && !this.settings.reducedMotion) {
      const shakePhase = this.currentBeat * Math.PI * 7.37;
      this.world.position.set(
        Math.sin(shakePhase) * this.shake * 0.5,
        Math.cos(shakePhase * 1.31) * this.shake * 0.5,
      );
      this.shake *= 0.84;
    } else {
      this.world.position.set(0, 0);
      this.shake = 0;
    }
  }

  private visibleEvents(): LevelEvent[] {
    return this.level.events.filter(
      (item) =>
        item.beat >= this.currentBeat - 2.2 &&
        item.beat <= this.currentBeat + 9.2,
    );
  }

  private eventX(item: LevelEvent): number {
    return PLAYER_X + (item.beat - this.currentBeat) * PIXELS_PER_BEAT;
  }

  private drawEvent(item: LevelEvent, pulse: number): void {
    const palette = this.level.palette;
    const x = this.eventX(item);
    const highContrast = this.settings.highContrast;
    const hazardColor = highContrast ? 0xffffff : palette.hazard;

    if (item.type === "spike" || item.type === "ceiling-spike") {
      const direction = item.type === "spike" ? -1 : 1;
      const base = item.type === "spike" ? FLOOR_Y : CEILING_Y;
      this.geometry
        .moveTo(x - 32, base)
        .lineTo(x, base + direction * 72)
        .lineTo(x + 32, base)
        .closePath()
        .fill({ color: hazardColor })
        .stroke({ color: palette.warning, width: 3, alpha: 0.9 });
    }

    if (item.type === "block") {
      const rect = this.blockRect(item, x);
      this.geometry
        .roundRect(rect.x, rect.y, rect.width, rect.height, 7)
        .fill({ color: palette.backgroundAlt })
        .stroke({ color: hazardColor, width: 5 });
      for (let y = rect.y + 18; y < rect.y + rect.height; y += 34) {
        this.geometry
          .moveTo(rect.x + 10, y)
          .lineTo(rect.x + rect.width - 10, y)
          .stroke({ color: palette.accentSoft, width: 2, alpha: 0.45 });
      }
    }

    if (item.type === "gap") {
      const width = (item.widthBeats ?? 1) * PIXELS_PER_BEAT;
      this.geometry
        .rect(x - 24, FLOOR_Y - 8, width + 48, HEIGHT - FLOOR_Y + 8)
        .fill({ color: palette.background });
      this.geometry
        .moveTo(x - 24, FLOOR_Y)
        .lineTo(x - 24, FLOOR_Y + 70)
        .moveTo(x + width + 24, FLOOR_Y)
        .lineTo(x + width + 24, FLOOR_Y + 70)
        .stroke({ color: palette.warning, width: 6 });
    }

    if (item.type === "pad") {
      this.geometry
        .moveTo(x - 42, FLOOR_Y)
        .lineTo(x - 22, FLOOR_Y - 18)
        .lineTo(x + 22, FLOOR_Y - 18)
        .lineTo(x + 42, FLOOR_Y)
        .closePath()
        .fill({ color: palette.warning, alpha: 0.85 + pulse * 0.15 });
    }

    if (item.type === "orb") {
      const y = item.y ?? 405;
      this.geometry
        .circle(x, y, 34 + pulse * 5)
        .stroke({ color: palette.warning, width: 6, alpha: 0.92 })
        .circle(x, y, 11)
        .fill({ color: palette.foreground });
    }

    if (item.type === "saw") {
      const y = item.y ?? (item.lane === "ceiling" ? 270 : 535);
      this.geometry
        .circle(x, y, 48)
        .fill({ color: palette.backgroundAlt })
        .stroke({ color: hazardColor, width: 8 })
        .circle(x, y, 14)
        .fill({ color: palette.warning });
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2 + this.currentBeat * 0.3;
        this.geometry
          .moveTo(x + Math.cos(angle) * 46, y + Math.sin(angle) * 46)
          .lineTo(x + Math.cos(angle) * 65, y + Math.sin(angle) * 65)
          .stroke({ color: hazardColor, width: 9 });
      }
    }

    if (item.type === "gate") {
      this.geometry
        .roundRect(x - 18, CEILING_Y + 28, 36, FLOOR_Y - CEILING_Y - 56, 18)
        .fill({ color: palette.accent, alpha: 0.1 })
        .stroke({ color: palette.accent, width: 5, alpha: 0.8 });
    }

    if (
      item.type === "fuse" &&
      item.fuseIndex !== undefined &&
      !this.collectedFuses.has(item.fuseIndex)
    ) {
      const y = item.y ?? 405;
      this.geometry
        .moveTo(x, y - 30)
        .lineTo(x + 24, y)
        .lineTo(x, y + 30)
        .lineTo(x - 24, y)
        .closePath()
        .fill({ color: palette.warning, alpha: 0.8 + pulse * 0.2 })
        .stroke({ color: palette.foreground, width: 3 });
    }

    if (this.practice && item.type === "checkpoint") {
      this.geometry
        .moveTo(x, CEILING_Y + 60)
        .lineTo(x, FLOOR_Y - 40)
        .stroke({ color: palette.warning, width: 3, alpha: 0.38 });
    }
  }

  private blockRect(
    item: LevelEvent,
    x: number,
  ): { x: number; y: number; width: number; height: number } {
    const height = item.height ?? 96;
    const width = BLOCK_WIDTH;
    return item.lane === "ceiling"
      ? { x: x - width / 2, y: CEILING_Y, width, height }
      : { x: x - width / 2, y: FLOOR_Y - height, width, height };
  }

  private drawPlayer(): void {
    const palette = this.level.palette;
    const color = this.settings.highContrast ? 0xffffff : palette.accent;
    const radius = PLAYER_SIZE / 2;
    this.player
      .clear()
      .moveTo(0, -radius)
      .lineTo(radius * 0.88, -radius * 0.5)
      .lineTo(radius * 0.88, radius * 0.5)
      .lineTo(0, radius)
      .lineTo(-radius * 0.88, radius * 0.5)
      .lineTo(-radius * 0.88, -radius * 0.5)
      .closePath()
      .fill({ color })
      .stroke({ color: palette.foreground, width: 4 })
      .circle(0, 0, 9)
      .fill({ color: palette.background });
  }

  private drawDeathBurst(): void {
    const palette = this.level.palette;
    this.particles.clear();
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const length = 50 + (index % 5) * 14;
      this.particles
        .moveTo(PLAYER_X, this.playerY)
        .lineTo(
          PLAYER_X + Math.cos(angle) * length,
          this.playerY + Math.sin(angle) * length,
        )
        .stroke({
          color: index % 2 ? palette.warning : palette.hazard,
          width: 7,
          alpha: 0.9,
        });
    }
  }

  private emitSnapshot(force: boolean, message?: string): void {
    const now = performance.now();
    if (!force && now - this.lastSnapshotAt < 90) {
      return;
    }
    this.lastSnapshotAt = now;
    this.callbacks.onSnapshot({
      phase: this.phase,
      beat: this.currentBeat,
      progress: Math.min(1, this.currentBeat / (this.level.bars * 4)),
      attempts: this.attempts,
      fuses: [...this.collectedFuses].sort(),
      checkpointBeat: this.checkpointBeat,
      message,
    });
  }

  private pollGamepad(): void {
    const gamepads = navigator.getGamepads?.() ?? [];
    const active = [...gamepads]
      .filter((gamepad): gamepad is Gamepad => Boolean(gamepad))
      .some((gamepad) =>
        gamepad.buttons.slice(0, 4).some((button) => button.pressed),
      );
    if (active && !this.gamepadActionHeld) {
      this.gamepadActionHeld = true;
      this.handlePress();
    } else if (!active && this.gamepadActionHeld) {
      this.gamepadActionHeld = false;
      this.handleRelease();
    }
  }
}
