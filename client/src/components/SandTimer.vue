<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  isHost: { type: Boolean, default: false },
  isMyTurn: { type: Boolean, default: false },
  turnActive: { type: Boolean, default: false },
  currentColor: { type: String, default: '#4ECDC4' },
  turnStartedAt: { type: String, default: null },
  accumulatedSand: { type: Array, default: () => [] },
  draining: { type: Boolean, default: false },
  canvasHeight: { type: Number, default: 200 },
});

const canvasRef = ref(null);
const PARTICLE_SIZE = 2;
const GRAVITY = 0.01;
const HORIZONTAL_DRIFT = 0.3;
const BASE_SPAWN_RATE = 0.1; // 1 particle every 4 seconds

let particles = [];
let grid = []; // 2D occupancy grid: grid[row][col] = particle ref or null
let gridRows = 0;
let gridCols = 0;
let animFrameId = null;
let lastSpawnTime = 0;
let running = false;
let canvasWidth = 0; // logical (CSS) width
let dpr = 1;
let containerObserver = null;

// Grid helpers
function toGridX(px) {
  return Math.floor(px / PARTICLE_SIZE);
}

function toGridY(py) {
  return Math.floor(py / PARTICLE_SIZE);
}

function isOccupied(gx, gy) {
  if (gx < 0 || gx >= gridCols || gy < 0 || gy >= gridRows) return true;
  return grid[gy][gx] !== null;
}

function occupy(gx, gy, p) {
  if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
    grid[gy][gx] = p;
    p.gx = gx;
    p.gy = gy;
  }
}

function vacate(gx, gy) {
  if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
    grid[gy][gx] = null;
  }
}

function initGrid(width, height) {
  canvasWidth = width;
  gridCols = Math.floor(width / PARTICLE_SIZE);
  gridRows = Math.floor(height / PARTICLE_SIZE);
  grid = [];
  for (let r = 0; r < gridRows; r++) {
    grid.push(new Array(gridCols).fill(null));
  }
}

function loadAccumulatedSand() {
  if (!props.accumulatedSand.length) return;

  for (const entry of props.accumulatedSand) {
    const count = entry.particleCount || 0;
    const color = entry.color || '#4ECDC4';
    for (let i = 0; i < count; i++) {
      const gx = Math.floor(Math.random() * gridCols);
      let gy = -1;
      for (let r = gridRows - 1; r >= 0; r--) {
        if (!grid[r][gx]) {
          gy = r;
          break;
        }
      }
      if (gy < 0) continue;

      const p = {
        x: gx * PARTICLE_SIZE,
        y: gy * PARTICLE_SIZE,
        vy: 0,
        vx: 0,
        settled: true,
        color,
        gx,
        gy,
      };
      occupy(gx, gy, p);
      particles.push(p);
    }
  }
}

function spawnParticle(color) {
  if (canvasWidth <= PARTICLE_SIZE) return;
  const x = Math.floor(Math.random() * (canvasWidth - PARTICLE_SIZE));
  particles.push({
    x,
    y: 0,
    vy: 0,
    vx: (Math.random() - 0.5) * HORIZONTAL_DRIFT * 2,
    settled: false,
    color,
    gx: toGridX(x),
    gy: 0,
  });
}

function getSpawnRate() {
  if (!props.turnStartedAt) return BASE_SPAWN_RATE;
  const elapsed = (Date.now() - new Date(props.turnStartedAt).getTime()) / 1000;
  // Ramp: double the rate every 5 minutes, cap at 4x base
  const multiplier = Math.min(1 + elapsed / 300, 4);
  return BASE_SPAWN_RATE * multiplier;
}

function update() {
  const now = performance.now();
  const height = props.canvasHeight;

  if (props.turnActive && props.turnStartedAt && !props.draining) {
    const spawnRate = getSpawnRate();
    const spawnInterval = 1000 / spawnRate;
    if (now - lastSpawnTime >= spawnInterval) {
      spawnParticle(props.currentColor);
      lastSpawnTime = now;
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.settled && !props.draining) continue;

    if (props.draining && p.settled) {
      vacate(p.gx, p.gy);
      p.settled = false;
      p.vy = 2 + Math.random() * 3;
      p.vx = (Math.random() - 0.5) * 1;
    }

    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) {
      p.x = 0;
      p.vx = Math.abs(p.vx) * 0.5;
    }
    if (p.x > canvasWidth - PARTICLE_SIZE) {
      p.x = canvasWidth - PARTICLE_SIZE;
      p.vx = -Math.abs(p.vx) * 0.5;
    }

    if (p.y > height + 20) {
      particles.splice(i, 1);
      continue;
    }

    if (!props.draining) {
      const newGx = Math.max(0, Math.min(toGridX(p.x), gridCols - 1));
      const newGy = Math.max(0, Math.min(toGridY(p.y), gridRows - 1));

      const belowOccupied =
        newGy >= gridRows - 1 || isOccupied(newGx, newGy + 1);

      if (belowOccupied && p.vy >= 0) {
        const canLeft =
          newGx > 0 &&
          !isOccupied(newGx - 1, newGy) &&
          !isOccupied(newGx - 1, newGy + 1);
        const canRight =
          newGx < gridCols - 1 &&
          !isOccupied(newGx + 1, newGy) &&
          !isOccupied(newGx + 1, newGy + 1);

        if (canLeft || canRight) {
          if (canLeft && canRight) {
            p.vx = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
          } else if (canLeft) {
            p.vx = -(0.5 + Math.random() * 0.5);
          } else {
            p.vx = 0.5 + Math.random() * 0.5;
          }
          p.vy = Math.max(p.vy * 0.3, GRAVITY);
        } else {
          let settleGy = newGy;
          if (isOccupied(newGx, settleGy)) {
            for (let r = settleGy - 1; r >= 0; r--) {
              if (!isOccupied(newGx, r)) {
                settleGy = r;
                break;
              }
            }
            if (isOccupied(newGx, settleGy)) {
              particles.splice(i, 1);
              continue;
            }
          }

          p.x = newGx * PARTICLE_SIZE;
          p.y = settleGy * PARTICLE_SIZE;
          p.vy = 0;
          p.vx = 0;
          p.settled = true;
          occupy(newGx, settleGy, p);
        }
      }
    }
  }
}

function draw(ctx) {
  const height = props.canvasHeight;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvasWidth, height);

  // Draw particles
  ctx.globalAlpha = 0.6;
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, PARTICLE_SIZE, PARTICLE_SIZE);
  }
  ctx.restore();
}

function loop() {
  if (!running) return;

  const canvas = canvasRef.value;
  if (!canvas) {
    animFrameId = requestAnimationFrame(loop);
    return;
  }

  const ctx = canvas.getContext('2d');
  update();
  draw(ctx);
  animFrameId = requestAnimationFrame(loop);
}

function startLoop() {
  if (running) return;
  running = true;
  lastSpawnTime = performance.now();
  loop();
}

function stopLoop() {
  running = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function resetJar() {
  particles = [];
  if (canvasWidth > 0) initGrid(canvasWidth, props.canvasHeight);
}

function sizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return 0;

  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = props.canvasHeight;
  if (width <= 0 || height <= 0) return 0;

  dpr = window.devicePixelRatio || 1;

  // Set the CSS display size
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Set the actual backing store size scaled by DPR
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  return width;
}

function rebuildGrid(newWidth, newHeight) {
  // Preserve settled particles, remap to new grid dimensions
  const oldSettled = particles.filter((p) => p.settled);
  const unsettled = particles.filter((p) => !p.settled);
  particles = [];

  initGrid(newWidth, newHeight);

  // Re-place settled particles: keep their x/y but clamp to new bounds
  for (const p of oldSettled) {
    const gx = Math.max(0, Math.min(toGridX(p.x), gridCols - 1));
    // Find lowest empty cell in this column
    let gy = -1;
    for (let r = gridRows - 1; r >= 0; r--) {
      if (!grid[r][gx]) {
        gy = r;
        break;
      }
    }
    if (gy < 0) continue;

    p.x = gx * PARTICLE_SIZE;
    p.y = gy * PARTICLE_SIZE;
    p.gx = gx;
    p.gy = gy;
    occupy(gx, gy, p);
    particles.push(p);
  }

  // Load accumulated sand on top
  if (props.accumulatedSand.length > 0 && oldSettled.length === 0) {
    loadAccumulatedSand();
  }

  // Re-add in-flight particles, clamping x
  for (const p of unsettled) {
    p.x = Math.max(0, Math.min(p.x, newWidth - PARTICLE_SIZE));
    particles.push(p);
  }
}

function handleContainerResize(entries) {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const entry = entries[0];
  const newWidth = Math.floor(entry.contentRect.width);
  if (newWidth > 0 && newWidth !== canvasWidth) {
    sizeCanvas();
    rebuildGrid(newWidth, props.canvasHeight);
  }
}

function initCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const width = sizeCanvas();
  if (width <= 0) return;

  initGrid(width, props.canvasHeight);

  if (props.accumulatedSand.length > 0) {
    loadAccumulatedSand();
  }

  // Watch container for width changes (e.g. sidebar expand transition)
  const container = canvas.parentElement;
  containerObserver = new ResizeObserver(handleContainerResize);
  containerObserver.observe(container);

  startLoop();
}

// Watch for drain trigger
watch(
  () => props.draining,
  (draining) => {
    if (draining) {
      const checkDrain = setInterval(() => {
        if (particles.length === 0) {
          clearInterval(checkDrain);
          resetJar();
        }
      }, 100);
    }
  }
);

// Watch canvasHeight changes — resize canvas and rebuild grid
watch(
  () => props.canvasHeight,
  (newHeight) => {
    if (newHeight > 0 && canvasRef.value) {
      sizeCanvas();
      rebuildGrid(canvasWidth, newHeight);
    }
  }
);

watch(
  () => props.accumulatedSand,
  (newSand, oldSand) => {
    if (newSand.length > (oldSand?.length || 0)) {
      // New turn recorded — existing particles stay, new ones spawn in new color
    }
  },
  { deep: true }
);

watch(
  () => props.currentColor,
  () => {
    // New turn started, particles will now spawn in the new color
  }
);

onMounted(() => {
  nextTick(() => initCanvas());
});

onUnmounted(() => {
  stopLoop();
  if (containerObserver) {
    containerObserver.disconnect();
    containerObserver = null;
  }
});
</script>

<template>
  <div class="sand-timer-canvas">
    <canvas ref="canvasRef" class="block" />
  </div>
</template>

<style scoped>
.sand-timer-canvas {
  width: 100%;
  height: 100%;
}
</style>
