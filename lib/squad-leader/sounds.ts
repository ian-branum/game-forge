// Procedural Web Audio synthesis for Squad Leader combat sounds.
// No audio files — everything is generated on-the-fly.

function shot(ctx: AudioContext, t: number, vol: number, pitch = 1.0) {
  try {
    const sr = ctx.sampleRate;

    // ── Crack: shaped noise burst ──────────────────────────────────────
    const crackLen = Math.ceil(sr * 0.09);
    const buf = ctx.createBuffer(1, crackLen, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 2.8);
    }
    const ns = ctx.createBufferSource();
    ns.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 550 * pitch;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (1200 + Math.random() * 500) * pitch;
    bp.Q.value = 0.85;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.68, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    ns.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    ns.start(t);

    // ── Thump: pitched sine decay ──────────────────────────────────────
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime((95 + Math.random() * 45) * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(28 * pitch, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.45, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
  } catch {
    // browser may block audio — fail silently
  }
}

/** 8–12 staggered rifle shots spread over ~450ms */
export function playSquadFire(ctx: AudioContext): void {
  const t0 = ctx.currentTime + 0.02;
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    shot(ctx, t0 + Math.random() * 0.45, 0.55 + Math.random() * 0.35, 0.80 + Math.random() * 0.40);
  }
}

/** 3 deliberate single shots ~300ms apart */
export function playLeaderFire(ctx: AudioContext): void {
  const t0 = ctx.currentTime + 0.02;
  shot(ctx, t0,        0.88, 1.00);
  shot(ctx, t0 + 0.30, 0.88, 1.00);
  shot(ctx, t0 + 0.60, 0.88, 1.00);
}

/** MG42: ~1250 RPM burst (19 rounds at 48ms spacing) */
export function playMGFire(ctx: AudioContext): void {
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 19; i++) {
    // Slightly higher pitch + harder crack than rifle
    shot(ctx, t0 + i * 0.048, 0.52, 1.15);
  }
}
