// ─── Audio Engine (Web Audio API — no external files) ──────────
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null;

// On HTTPS, browsers block AudioContext until a user gesture.
document.addEventListener('click', function bootstrap() {
  try {
    if (!ac) ac = new AC();
    if (ac.state !== 'running') ac.resume().catch(() => {});
  } catch(e) {}
  document.removeEventListener('click', bootstrap, true);
}, true);

function play(fn) {
  try {
    if (!ac) ac = new AC();
    if (ac.state === 'running') {
      fn(ac, ac.currentTime);
    } else {
      ac.resume().then(() => fn(ac, ac.currentTime)).catch(() => {});
    }
  } catch(e) {}
}

function osc(c, freq, type, start, dur, vol, freqEnd) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.start(start); o.stop(start + dur + 0.01);
}

function noise(c, start, dur, vol) {
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.8;
  const g = c.createGain();
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.start(start); src.stop(start + dur + 0.01);
}

const SFX = {
  click() {
    play((c, t) => {
      noise(c, t, 0.04, 0.12);
      osc(c, 200, 'sine', t, 0.06, 0.1, 80);
    });
  },
  win() {
    play((c, t) => {
      [[392,'square'],[523,'square'],[659,'square'],[784,'square'],[1047,'square']]
        .forEach(([f, type], i) => osc(c, f, type, t + i * 0.10, 0.18, 0.22));
      [523,659,784,1047].forEach(f => osc(c, f, 'sine', t + 0.55, 0.5, 0.12));
      noise(c, t, 0.06, 0.15);
    });
  },
  move() {
    play((c, t) => {
      osc(c, 300, 'sine', t, 0.04, 0.1, 350);
    });
  }
};

// ─── Particle System ───────────────────────────────────────────
let particles      = [];
let animFrame      = null;
let spawnTimer     = null;
let confettiColors = [];

function startParticles(canvas, colors) {
  const ctx = canvas.getContext('2d');
  confettiColors = colors;
  particles = [];
  if (animFrame) cancelAnimationFrame(animFrame);
  if (spawnTimer) clearInterval(spawnTimer);

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const ORIGINS = () => [
    { x: canvas.width * 0.15, y: canvas.height * 0.35 },
    { x: canvas.width * 0.85, y: canvas.height * 0.35 },
    { x: canvas.width * 0.50, y: canvas.height * 0.40 },
    { x: canvas.width * 0.05, y: canvas.height * 0.55 },
    { x: canvas.width * 0.95, y: canvas.height * 0.55 },
  ];

  class Particle {
    constructor() { this.init(); }
    init() {
      const origins = ORIGINS();
      const o = origins[Math.floor(Math.random() * origins.length)];
      this.x  = o.x + (Math.random() - 0.5) * 120;
      this.y  = o.y + (Math.random() - 0.5) * 60;
      const angle = Math.random() * Math.PI * 2;
      const spd   = Math.random() * 14 + 4;
      this.vx  = Math.cos(angle) * spd;
      this.vy  = Math.sin(angle) * spd - 9;
      this.g   = 0.28;
      this.w   = Math.random() * 14 + 5;
      this.h   = this.w * (Math.random() * 0.5 + 0.3);
      this.color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      this.rot  = Math.random() * 360;
      this.rotV = (Math.random() - 0.5) * 14;
      this.born = performance.now();
      this.life = Math.random() * 1800 + 1400;
      this.shape = Math.floor(Math.random() * 3);
    }
    alive() { return (performance.now() - this.born) < this.life; }
    update() {
      this.vy += this.g;
      this.x  += this.vx;
      this.y  += this.vy;
      this.vx *= 0.992;
      this.rot += this.rotV;
    }
    alpha() { return Math.max(0, 1 - (performance.now() - this.born) / this.life); }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha();
      ctx.fillStyle   = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot * Math.PI / 180);
      if (this.shape === 0) {
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      } else if (this.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, this.w / 2, this.h / 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Initial burst
  for (let i = 0; i < 200; i++) particles.push(new Particle());

  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alive());
    particles.forEach(p => { p.update(); p.draw(ctx); });
    animFrame = requestAnimationFrame(loop);
  })();

  return {
    stop: () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = [];
      window.removeEventListener('resize', resizeCanvas);
    }
  };
}
