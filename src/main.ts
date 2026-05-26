import "./styles.css";

type GameMode = "intro" | "playing" | "paused" | "won" | "lost";
type BulletOwner = "enemy" | "player";

type Bullet = {
  id: number;
  owner: BulletOwner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fireTimer: number;
  phase: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
};

type PointerState = {
  active: boolean;
  id: number | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startedAt: number;
  moved: boolean;
};

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

const SURVIVE_SECONDS = 20;
const SLOW_TIME_SCALE = 0.2;
const SLOW_MAX_SECONDS = 8.5;
const SLOW_RECHARGE_PER_SECOND = 2.0;
const ENEMY_BULLET_HITBOX_SCALE = 0.78;
const PLAYER_TOP_MARGIN = 96;
const TAP_MS = 180;
const TAP_DISTANCE = 14;

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function mustContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const renderingContext = canvasElement.getContext("2d");
  if (!renderingContext) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return renderingContext;
}

const canvas = mustQuery<HTMLCanvasElement>("#game");
const scoreEl = mustQuery<HTMLElement>("#score");
const comboEl = mustQuery<HTMLElement>("#combo");
const timeEl = mustQuery<HTMLElement>("#time");
const bestEl = mustQuery<HTMLElement>("#best");
const dashFillEl = mustQuery<HTMLElement>("#dash-fill");
const overlay = mustQuery<HTMLElement>("#overlay");
const overlayTitle = mustQuery<HTMLElement>("#overlay-title");
const overlayBody = mustQuery<HTMLElement>("#overlay-body");
const primaryAction = mustQuery<HTMLButtonElement>("#primary-action");
const ctx = mustContext(canvas);

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const background = new Image();
background.src = assetUrl("assets/prism-orchard-bg.png");

const sprites = new Image();
sprites.src = assetUrl("assets/generated/combat-sprites.png");

const keys = new Set<string>();
const pointer: PointerState = {
  active: false,
  id: null,
  x: 0,
  y: 0,
  startX: 0,
  startY: 0,
  startedAt: 0,
  moved: false,
};

const player = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  radius: 15,
  speed: 420,
};

const state = {
  mode: "intro" as GameMode,
  width: 0,
  height: 0,
  dpr: 1,
  elapsed: 0,
  spawnTimer: 0.65,
  slowEnergy: SLOW_MAX_SECONDS,
  score: 0,
  best: Number(localStorage.getItem("slowshot-nova-best") ?? localStorage.getItem("blue-edge-best") ?? 0),
  bulletId: 0,
  enemyId: 0,
  shake: 0,
  visualTime: 0,
  lastFrame: performance.now(),
};

let bullets: Bullet[] = [];
let enemies: Enemy[] = [];
let sparks: Spark[] = [];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function currentTimeScale(): number {
  return isSlowActive() ? SLOW_TIME_SCALE : 1;
}

function isSlowRequested(): boolean {
  return pointer.active || keys.has("ShiftLeft") || keys.has("ShiftRight");
}

function isSlowActive(): boolean {
  return state.mode === "playing" && isSlowRequested() && state.slowEnergy > 0;
}

function resize(): void {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.max(320, Math.floor(window.innerWidth));
  state.height = Math.max(480, Math.floor(window.innerHeight));
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const minY = PLAYER_TOP_MARGIN;
  player.x = clamp(player.x || state.width / 2, player.radius + 8, state.width - player.radius - 8);
  player.y = clamp(player.y || state.height * 0.78, minY, state.height - player.radius - 22);
  player.targetX = player.x;
  player.targetY = player.y;
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, player.radius + 8, state.width - player.radius - 8),
    y: clamp(event.clientY - rect.top, PLAYER_TOP_MARGIN, state.height - player.radius - 22),
  };
}

function startGame(): void {
  state.mode = "playing";
  state.elapsed = 0;
  state.spawnTimer = 0.4;
  state.slowEnergy = SLOW_MAX_SECONDS;
  state.score = 0;
  state.shake = 0;
  bullets = [];
  enemies = [];
  sparks = [];
  pointer.active = false;
  pointer.id = null;
  player.x = state.width / 2;
  player.y = state.height * 0.78;
  player.targetX = player.x;
  player.targetY = player.y;
  overlay.hidden = true;
  canvas.focus();
  updateHud();
}

function finishGame(mode: "won" | "lost"): void {
  state.mode = mode;
  pointer.active = false;
  pointer.id = null;

  if (mode === "won") {
    state.best = Math.max(state.best, state.score);
    localStorage.setItem("slowshot-nova-best", String(state.best));
    overlayTitle.textContent = "20 seconds survived.";
    overlayBody.textContent = `Clear. Your counter shots erased ${state.score} threats.`;
    burst(player.x, player.y, "#7efcff", 34);
  } else {
    overlayTitle.textContent = "One hit ends the run.";
    overlayBody.textContent = `You survived ${state.elapsed.toFixed(1)}s. Let the slow gauge recover, then hold a swipe to bend time again.`;
  }

  primaryAction.textContent = "Retry";
  overlay.hidden = false;
  updateHud();
}

function togglePause(): void {
  if (state.mode === "playing") {
    state.mode = "paused";
    pointer.active = false;
    pointer.id = null;
    overlayTitle.textContent = "Paused";
    overlayBody.textContent = "Resume when you are ready. The slow reserve only recovers while time is moving normally.";
    primaryAction.textContent = "Resume";
    overlay.hidden = false;
  } else if (state.mode === "paused") {
    state.mode = "playing";
    overlay.hidden = true;
    canvas.focus();
  }
}

function shoot(angle: number, speed: number, radius = 5): void {
  bullets.push({
    id: state.bulletId++,
    owner: "player",
    x: player.x,
    y: player.y - player.radius - 6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    color: "#f8e889",
    glow: "rgb(248 232 137 / 42%)",
  });
}

function tapShot(): void {
  if (state.mode !== "playing") {
    return;
  }
  shoot(-Math.PI / 2, 620, 5);
  burst(player.x, player.y - player.radius, "#f8e889", 5);
}

function counterShot(): void {
  if (state.mode !== "playing") {
    return;
  }
  const spread = [-0.52, -0.26, 0, 0.26, 0.52];
  for (const offset of spread) {
    shoot(-Math.PI / 2 + offset, 720, offset === 0 ? 7 : 5);
  }
  burst(player.x, player.y - player.radius, "#7efcff", 16);
}

function targetEnemyCount(): number {
  return Math.min(54, Math.max(3, Math.floor(2.8 * Math.exp(state.elapsed / 4.8))));
}

function spawnEnemy(): void {
  const side = Math.random() < 0.5 ? -1 : 1;
  const pressure = clamp(state.elapsed / SURVIVE_SECONDS, 0, 1);
  const x = random(42, state.width - 42);
  const y = random(-130, -42);
  const drift = random(16, 58) * side * (1 + pressure * 1.2);
  enemies.push({
    id: state.enemyId++,
    x,
    y,
    vx: drift,
    vy: random(34, 72) + pressure * 88,
    radius: random(20, 28),
    fireTimer: random(0.12, 0.62),
    phase: random(0, Math.PI * 2),
  });
}

function fireEnemyBullet(enemy: Enemy): void {
  const elapsedPressure = clamp(state.elapsed / SURVIVE_SECONDS, 0, 1);
  const aimX = player.x + random(-44, 44) * (1 - elapsedPressure * 0.45);
  const aimY = player.y + random(-32, 32);
  const x = enemy.x;
  const y = enemy.y + enemy.radius * 0.55;
  const angle = Math.atan2(aimY - y, aimX - x);
  const speed = random(185, 275) + elapsedPressure * 145;

  bullets.push({
    id: state.bulletId++,
    owner: "enemy",
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: random(8, 12),
    color: "#ff6887",
    glow: "rgb(255 104 135 / 42%)",
  });
}

function updateEnemies(gameDt: number): void {
  const targetCount = targetEnemyCount();
  const spawnBurst = Math.min(6, targetCount - enemies.length);
  for (let index = 0; index < spawnBurst; index += 1) {
    spawnEnemy();
  }

  const pressure = clamp(state.elapsed / SURVIVE_SECONDS, 0, 1);
  for (const enemy of enemies) {
    enemy.phase += gameDt * (2.6 + pressure * 2.4);
    enemy.x += (enemy.vx + Math.sin(enemy.phase) * (42 + pressure * 52)) * gameDt;
    enemy.y += enemy.vy * gameDt;
    if (enemy.x < enemy.radius || enemy.x > state.width - enemy.radius) {
      enemy.vx *= -1;
      enemy.x = clamp(enemy.x, enemy.radius, state.width - enemy.radius);
    }

    enemy.fireTimer -= gameDt;
    if (enemy.fireTimer <= 0) {
      fireEnemyBullet(enemy);
      enemy.fireTimer = random(0.52, 1.0) / (1 + pressure * 3.4);
    }
  }

  enemies = enemies.filter((enemy) => enemy.y < state.height + 90);
}

function updatePlayer(realDt: number): void {
  if (pointer.active) {
    player.targetX = pointer.x;
    player.targetY = pointer.y;
  }

  const xDir = Number(keys.has("ArrowRight") || keys.has("KeyD")) - Number(keys.has("ArrowLeft") || keys.has("KeyA"));
  const yDir = Number(keys.has("ArrowDown") || keys.has("KeyS")) - Number(keys.has("ArrowUp") || keys.has("KeyW"));

  if (xDir !== 0) {
    player.targetX = player.x + xDir * player.speed * realDt;
  }
  if (yDir !== 0) {
    player.targetY = player.y + yDir * player.speed * realDt;
  }

  player.targetX = clamp(player.targetX, player.radius + 8, state.width - player.radius - 8);
  player.targetY = clamp(player.targetY, PLAYER_TOP_MARGIN, state.height - player.radius - 22);
  player.x += (player.targetX - player.x) * Math.min(1, realDt * 18);
  player.y += (player.targetY - player.y) * Math.min(1, realDt * 18);
}

function update(realDt: number): void {
  const safeDt = Math.min(realDt, 0.05);
  state.visualTime += safeDt;

  if (state.mode !== "playing") {
    updateSparks(safeDt);
    return;
  }

  const slowActive = isSlowActive();
  if (slowActive) {
    state.slowEnergy = Math.max(0, state.slowEnergy - safeDt);
  } else if (!isSlowRequested()) {
    state.slowEnergy = Math.min(SLOW_MAX_SECONDS, state.slowEnergy + safeDt * SLOW_RECHARGE_PER_SECOND);
  }

  const timeScale = slowActive ? SLOW_TIME_SCALE : 1;
  const gameDt = safeDt * timeScale;
  state.elapsed += gameDt;
  if (state.elapsed >= SURVIVE_SECONDS) {
    finishGame("won");
    return;
  }

  updatePlayer(safeDt);

  state.spawnTimer -= gameDt;
  if (state.spawnTimer <= 0 && enemies.length < targetEnemyCount()) {
    spawnEnemy();
    state.spawnTimer = 0.08;
  }

  updateEnemies(gameDt);

  for (const bullet of bullets) {
    bullet.x += bullet.vx * gameDt;
    bullet.y += bullet.vy * gameDt;
  }

  resolveShotCollisions();
  resolveEnemyCollisions();
  resolvePlayerCollision();
  bullets = bullets.filter((bullet) => {
    const margin = 60;
    return bullet.x > -margin && bullet.x < state.width + margin && bullet.y > -margin && bullet.y < state.height + margin;
  });

  state.shake = Math.max(0, state.shake - safeDt * 18);
  updateSparks(safeDt);
  updateHud();
}

function resolveShotCollisions(): void {
  const enemyBullets = bullets.filter((bullet) => bullet.owner === "enemy");
  const playerBullets = bullets.filter((bullet) => bullet.owner === "player");
  const removed = new Set<number>();

  for (const shot of playerBullets) {
    for (const enemy of enemyBullets) {
      if (removed.has(shot.id) || removed.has(enemy.id)) {
        continue;
      }
      if (distance(shot.x, shot.y, enemy.x, enemy.y) <= shot.radius + enemy.radius + 4) {
        removed.add(shot.id);
        removed.add(enemy.id);
        state.score += 1;
        burst(enemy.x, enemy.y, "#9ff9ff", 10);
      }
    }
  }

  if (removed.size > 0) {
    bullets = bullets.filter((bullet) => !removed.has(bullet.id));
  }
}

function resolveEnemyCollisions(): void {
  const playerBullets = bullets.filter((bullet) => bullet.owner === "player");
  const removedBullets = new Set<number>();
  const removedEnemies = new Set<number>();

  for (const shot of playerBullets) {
    for (const enemy of enemies) {
      if (removedBullets.has(shot.id) || removedEnemies.has(enemy.id)) {
        continue;
      }
      if (distance(shot.x, shot.y, enemy.x, enemy.y) <= shot.radius + enemy.radius * 0.72) {
        removedBullets.add(shot.id);
        removedEnemies.add(enemy.id);
        state.score += 5;
        burst(enemy.x, enemy.y, "#ff7b9d", 18);
      }
    }
  }

  if (removedBullets.size > 0) {
    bullets = bullets.filter((bullet) => !removedBullets.has(bullet.id));
  }
  if (removedEnemies.size > 0) {
    enemies = enemies.filter((enemy) => !removedEnemies.has(enemy.id));
  }
}

function resolvePlayerCollision(): void {
  for (const enemy of enemies) {
    if (distance(player.x, player.y, enemy.x, enemy.y) <= player.radius + enemy.radius * 0.62) {
      state.shake = 12;
      burst(player.x, player.y, "#ff6887", 26);
      finishGame("lost");
      return;
    }
  }

  for (const bullet of bullets) {
    if (bullet.owner !== "enemy") {
      continue;
    }
    if (distance(player.x, player.y, bullet.x, bullet.y) <= player.radius + bullet.radius * ENEMY_BULLET_HITBOX_SCALE - 3) {
      state.shake = 12;
      burst(player.x, player.y, "#ff6887", 26);
      finishGame("lost");
      return;
    }
  }
}

function updateSparks(dt: number): void {
  for (const spark of sparks) {
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= 1 - Math.min(0.7, dt * 1.6);
    spark.vy *= 1 - Math.min(0.7, dt * 1.6);
  }
  sparks = sparks.filter((spark) => spark.life > 0);
}

function burst(x: number, y: number, color: string, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(45, 260);
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: random(0.18, 0.62),
      maxLife: 0.62,
      color,
      radius: random(2, 5),
    });
  }
}

function updateHud(): void {
  const timeLeft = Math.max(0, SURVIVE_SECONDS - state.elapsed);
  scoreEl.textContent = `${state.score}`;
  comboEl.textContent = isSlowActive() ? "SLOW" : state.slowEnergy <= 0 ? "EMPTY" : "LIVE";
  timeEl.textContent = `${timeLeft.toFixed(1)}`;
  bestEl.textContent = state.mode === "won" ? "CLEAR" : state.mode === "lost" ? "HIT" : `${state.best}`;
  dashFillEl.style.transform = `scaleX(${state.slowEnergy / SLOW_MAX_SECONDS})`;
  dashFillEl.dataset.status = state.slowEnergy <= 0 ? "empty" : isSlowActive() ? "active" : "ready";
}

function render(): void {
  const offsetX = state.shake > 0 ? random(-state.shake, state.shake) : 0;
  const offsetY = state.shake > 0 ? random(-state.shake, state.shake) : 0;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  drawBackground();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawSparks();
  if (isSlowActive() && state.mode === "playing") {
    drawSlowEdge();
  }
  ctx.restore();
}

function drawBackground(): void {
  ctx.clearRect(0, 0, state.width, state.height);
  if (background.complete && background.naturalWidth > 0) {
    const scale = Math.max(state.width / background.naturalWidth, state.height / background.naturalHeight);
    const width = background.naturalWidth * scale;
    const height = background.naturalHeight * scale;
    ctx.drawImage(background, (state.width - width) / 2, (state.height - height) / 2, width, height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, "#101936");
    gradient.addColorStop(0.55, "#153336");
    gradient.addColorStop(1, "#1b1724");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  ctx.fillStyle = "rgb(3 7 18 / 42%)";
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = "rgb(255 255 255 / 8%)";
  ctx.lineWidth = 1;
  for (let y = 92; y < state.height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y + Math.sin(y * 0.015) * 18);
    ctx.stroke();
  }
}

function drawSprite(spriteIndex: number, x: number, y: number, width: number, height: number, rotation = 0): boolean {
  if (!sprites.complete || sprites.naturalWidth <= 0 || sprites.naturalHeight <= 0) {
    return false;
  }

  const cellWidth = sprites.naturalWidth / 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(
    sprites,
    cellWidth * spriteIndex,
    0,
    cellWidth,
    sprites.naturalHeight,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  ctx.restore();
  return true;
}

function drawPlayer(): void {
  const slow = isSlowActive() && state.mode === "playing";
  ctx.save();

  const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, slow ? 82 : 56);
  glow.addColorStop(0, slow ? "rgb(126 252 255 / 56%)" : "rgb(248 232 137 / 46%)");
  glow.addColorStop(1, "rgb(126 252 255 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, slow ? 82 : 56, 0, Math.PI * 2);
  ctx.fill();

  if (drawSprite(0, player.x, player.y, 78, 78)) {
    ctx.restore();
    return;
  }

  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#f8e889";
  ctx.strokeStyle = slow ? "#7efcff" : "#fff8be";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -player.radius - 8);
  ctx.lineTo(player.radius + 14, player.radius + 8);
  ctx.lineTo(0, player.radius);
  ctx.lineTo(-player.radius - 14, player.radius + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#17303a";
  ctx.beginPath();
  ctx.arc(0, 1, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemies(): void {
  for (const enemy of enemies) {
    const pulse = Math.sin(state.visualTime * 6 + enemy.phase) * 0.5 + 0.5;
    const glow = ctx.createRadialGradient(enemy.x, enemy.y, 4, enemy.x, enemy.y, enemy.radius * (2.2 + pulse * 0.45));
    glow.addColorStop(0, "rgb(255 83 126 / 38%)");
    glow.addColorStop(1, "rgb(255 83 126 / 0%)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    if (drawSprite(1, enemy.x, enemy.y, enemy.radius * 3.0, enemy.radius * 3.0, Math.sin(enemy.phase) * 0.08)) {
      continue;
    }

    ctx.fillStyle = "#84213f";
    ctx.strokeStyle = "#ff6b90";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y + enemy.radius);
    ctx.lineTo(enemy.x - enemy.radius * 1.2, enemy.y - enemy.radius * 0.4);
    ctx.lineTo(enemy.x, enemy.y - enemy.radius * 1.25);
    ctx.lineTo(enemy.x + enemy.radius * 1.2, enemy.y - enemy.radius * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawBullets(): void {
  for (const bullet of bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, bullet.radius * 3.2);
    glow.addColorStop(0, bullet.glow);
    glow.addColorStop(1, "rgb(255 255 255 / 0%)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const angle = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2;
    ctx.restore();
    if (drawSprite(2, bullet.x, bullet.y, bullet.radius * 5.5, bullet.radius * 9.2, angle)) {
      continue;
    }

    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.fillStyle = bullet.color;
    ctx.strokeStyle = bullet.owner === "enemy" ? "#ffd3dc" : "#fff9bc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawSparks(): void {
  for (const spark of sparks) {
    ctx.globalAlpha = clamp(spark.life / spark.maxLife, 0, 1);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSlowEdge(): void {
  const pulse = Math.sin(state.visualTime * 16) * 0.5 + 0.5;
  const edge = 22 + pulse * 10;
  const gradient = ctx.createRadialGradient(state.width / 2, state.height / 2, Math.min(state.width, state.height) * 0.32, state.width / 2, state.height / 2, Math.max(state.width, state.height) * 0.72);
  gradient.addColorStop(0, "rgb(60 180 255 / 0%)");
  gradient.addColorStop(0.72, "rgb(75 204 255 / 10%)");
  gradient.addColorStop(1, "rgb(75 204 255 / 44%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = "rgb(96 218 255 / 70%)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= state.width; x += 24) {
    const wave = Math.sin(x * 0.045 + state.visualTime * 18) * 7;
    ctx.lineTo(x, edge + wave);
  }
  for (let y = 0; y <= state.height; y += 24) {
    const wave = Math.cos(y * 0.045 + state.visualTime * 18) * 7;
    ctx.lineTo(state.width - edge + wave, y);
  }
  for (let x = state.width; x >= 0; x -= 24) {
    const wave = Math.sin(x * 0.045 + state.visualTime * 18) * 7;
    ctx.lineTo(x, state.height - edge + wave);
  }
  for (let y = state.height; y >= 0; y -= 24) {
    const wave = Math.cos(y * 0.045 + state.visualTime * 18) * 7;
    ctx.lineTo(edge + wave, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function loop(time: number): void {
  const dt = (time - state.lastFrame) / 1000;
  state.lastFrame = time;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}

primaryAction.addEventListener("click", () => {
  if (state.mode === "paused") {
    togglePause();
    return;
  }
  startGame();
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "Space") {
    event.preventDefault();
    tapShot();
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    togglePause();
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
  if (event.code === "Enter" && state.mode !== "playing") {
    startGame();
  }
  updateHud();
});

window.addEventListener("keyup", (event) => {
  const wasSlowKey = event.code === "ShiftLeft" || event.code === "ShiftRight";
  keys.delete(event.code);
  if (wasSlowKey && state.mode === "playing") {
    counterShot();
  }
  updateHud();
});

canvas.addEventListener("pointerdown", (event) => {
  if (state.mode === "intro" || state.mode === "won" || state.mode === "lost") {
    startGame();
  }
  if (state.mode !== "playing") {
    return;
  }

  const position = pointerPosition(event);
  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.x = position.x;
  pointer.y = position.y;
  pointer.startX = position.x;
  pointer.startY = position.y;
  pointer.startedAt = performance.now();
  pointer.moved = false;
  player.targetX = position.x;
  player.targetY = position.y;
  canvas.setPointerCapture(event.pointerId);
  updateHud();
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active || pointer.id !== event.pointerId) {
    return;
  }

  const position = pointerPosition(event);
  pointer.x = position.x;
  pointer.y = position.y;
  pointer.moved = pointer.moved || distance(pointer.startX, pointer.startY, pointer.x, pointer.y) > TAP_DISTANCE;
  player.targetX = position.x;
  player.targetY = position.y;
});

function finishPointer(event: PointerEvent): void {
  if (!pointer.active || pointer.id !== event.pointerId) {
    return;
  }

  const heldMs = performance.now() - pointer.startedAt;
  const didTap = heldMs <= TAP_MS && !pointer.moved;
  pointer.active = false;
  pointer.id = null;

  if (state.mode === "playing") {
    if (didTap) {
      tapShot();
    } else {
      counterShot();
    }
  }
  updateHud();
}

canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);

window.addEventListener("blur", () => {
  if (state.mode === "playing") {
    togglePause();
  }
});

window.addEventListener("resize", resize);

window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let index = 0; index < steps; index += 1) {
    update(1 / 60);
  }
  render();
};

window.render_game_to_text = () => JSON.stringify({
  coordinates: "origin top-left, x right, y down",
  mode: state.mode,
  elapsed: Number(state.elapsed.toFixed(2)),
  timeLeft: Number(Math.max(0, SURVIVE_SECONDS - state.elapsed).toFixed(2)),
  timeScale: currentTimeScale(),
  slowRequested: isSlowRequested(),
  slowActive: isSlowActive(),
  slowEnergy: Number(state.slowEnergy.toFixed(2)),
  slowEnergyMax: SLOW_MAX_SECONDS,
  enemyBulletHitboxScale: ENEMY_BULLET_HITBOX_SCALE,
  player: {
    x: Number(player.x.toFixed(1)),
    y: Number(player.y.toFixed(1)),
    radius: player.radius,
  },
  bullets: bullets.slice(0, 16).map((bullet) => ({
    owner: bullet.owner,
    x: Number(bullet.x.toFixed(1)),
    y: Number(bullet.y.toFixed(1)),
    vx: Number(bullet.vx.toFixed(1)),
    vy: Number(bullet.vy.toFixed(1)),
    radius: Number(bullet.radius.toFixed(1)),
  })),
  enemies: enemies.slice(0, 16).map((enemy) => ({
    x: Number(enemy.x.toFixed(1)),
    y: Number(enemy.y.toFixed(1)),
    radius: Number(enemy.radius.toFixed(1)),
    fireTimer: Number(enemy.fireTimer.toFixed(2)),
  })),
  enemyCount: enemies.length,
  targetEnemyCount: targetEnemyCount(),
  enemyBulletCount: bullets.filter((bullet) => bullet.owner === "enemy").length,
  playerBulletCount: bullets.filter((bullet) => bullet.owner === "player").length,
  score: state.score,
});

resize();
updateHud();
requestAnimationFrame(loop);
