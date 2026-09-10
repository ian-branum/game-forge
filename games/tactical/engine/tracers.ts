// Tracer / muzzle-flash animation for Squad Leader.
// Draws onto a <canvas> overlay that sits on top of the SVG map.

export type UnitType = "infantry" | "leader" | "mg" | "mortar" | "vehicle";

interface Particle {
  x: number; y: number;       // current position
  vx: number; vy: number;     // velocity px/frame
  life: number;               // 0–1 remaining life
  decay: number;              // life lost per frame
  r: number; g: number; b: number; // colour
  size: number;               // radius
  tracer: boolean;            // long streak vs dot
}

/** Return a random jitter around a point */
function jitter(cx: number, cy: number, radius: number): [number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/**
 * Animate tracers from originHex centre to targetHex centre.
 *
 * @param canvas  - overlay canvas (same size as the SVG)
 * @param ox, oy  - origin pixel (centre of source hex)
 * @param tx, ty  - target pixel (centre of target hex)
 * @param unitType - determines burst pattern
 */
export function animateTracers(
  canvas: HTMLCanvasElement,
  ox: number, oy: number,
  tx: number, ty: number,
  unitType: UnitType,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const particles: Particle[] = [];
  const HEX_R = 22; // jitter radius inside hex

  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normalised direction
  const nx = dx / dist;
  const ny = dy / dist;

  // ── Burst factory ─────────────────────────────────────────────────────────

  function addTracer(srcX: number, srcY: number, dstX: number, dstY: number, delay: number, color: [number,number,number]) {
    const ddx = dstX - srcX;
    const ddy = dstY - srcY;
    const d   = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const spd = 8 + Math.random() * 4;   // px/frame
    const frames = d / spd;

    // We'll emit the particle so it arrives at dst in ~frames frames
    // Instead of simulating full travel, we create a fast streak + explosion at target
    const vx = (ddx / d) * spd;
    const vy = (ddy / d) * spd;

    particles.push({
      x: srcX, y: srcY,
      vx, vy,
      life: 1, decay: 1 / frames,
      r: color[0], g: color[1], b: color[2],
      size: 1.8 + Math.random() * 1.2,
      tracer: true,
    });

    // Muzzle flash at source (brief, offset slightly toward target)
    particles.push({
      x: srcX + nx * 4, y: srcY + ny * 4,
      vx: nx * 0.5, vy: ny * 0.5,
      life: 1, decay: 0.22,
      r: 255, g: 220, b: 80,
      size: 3.5 + Math.random() * 2,
      tracer: false,
    });
  }

  function addImpact(dstX: number, dstY: number, delay: number) {
    // Spark burst at impact point
    for (let k = 0; k < 5; k++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 2;
      particles.push({
        x: dstX, y: dstY,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 1, decay: 0.05 + Math.random() * 0.04,
        r: 255, g: 160 + Math.floor(Math.random() * 80), b: 30,
        size: 1.5 + Math.random() * 1.5,
        tracer: false,
      });
    }
  }

  // ── Build particles per unit type ─────────────────────────────────────────

  if (unitType === "infantry") {
    // 8–12 individual rifles from various points in source hex → various in target
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const delay = i * 40;
      const [sx, sy] = jitter(ox, oy, HEX_R * 0.8);
      const [ex, ey] = jitter(tx, ty, HEX_R * 0.7);
      addTracer(sx, sy, ex, ey, delay, [255, 230, 120]);
      addImpact(ex, ey, delay);
    }

  } else if (unitType === "leader") {
    // 3 precise shots from dead centre of hex → dead centre of target
    for (let i = 0; i < 3; i++) {
      const delay = i * 320;
      setTimeout(() => {
        addTracer(ox, oy, tx, ty, 0, [200, 240, 255]);
        addImpact(tx, ty, 0);
      }, delay);
    }

  } else if (unitType === "mg") {
    // Sustained burst from centre → spray across target hex
    const count = 22;
    for (let i = 0; i < count; i++) {
      const delay = i * 48;
      const [ex, ey] = jitter(tx, ty, HEX_R * 0.9);
      addTracer(ox, oy, ex, ey, delay, [255, 80, 80]);
      addImpact(ex, ey, delay);
    }
  } else {
    // Fallback — single tracer
    addTracer(ox, oy, tx, ty, 0, [255, 200, 80]);
    addImpact(tx, ty, 0);
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  let frame = 0;
  const MAX_FRAMES = 120;

  function render() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      if (p.life <= 0) continue;

      ctx!.save();
      ctx!.globalAlpha = p.life;

      if (p.tracer) {
        // Draw a streaky line in direction of motion
        const len = 6 + (1 - p.life) * 4;
        ctx!.strokeStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.lineWidth = p.size * 0.7;
        ctx!.shadowColor = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.shadowBlur = 5;
        ctx!.beginPath();
        ctx!.moveTo(p.x - p.vx * (len / (Math.sqrt(p.vx**2+p.vy**2)||1)), p.y - p.vy * (len / (Math.sqrt(p.vx**2+p.vy**2)||1)));
        ctx!.lineTo(p.x, p.y);
        ctx!.stroke();
      } else {
        // Glowing dot
        ctx!.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.shadowColor = `rgb(${p.r},${p.g},${p.b})`;
        ctx!.shadowBlur = 8;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();

      // Advance
      p.x    += p.vx;
      p.y    += p.vy;
      p.life -= p.decay;
    }

    frame++;
    const alive = particles.some(p => p.life > 0);
    if (alive && frame < MAX_FRAMES) {
      requestAnimationFrame(render);
    } else {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render();
}
