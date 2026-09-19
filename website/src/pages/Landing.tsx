import { Link } from 'react-router';
import { useEffect, useRef } from 'react';

const PALETTE = [
  '#4ade80','#22c55e','#16a34a','#86efac',
  '#facc15','#ca8a04','#a16207','#fde047',
  '#f87171','#dc2626','#b91c1c','#fca5a5',
  '#60a5fa','#2563eb','#1d4ed8','#93c5fd',
  '#a78bfa','#7c3aed','#6d28d9','#c4b5fd',
  '#22d3ee','#0891b2','#0e7490','#67e8f9',
];

// Deterministic seeded random so squares are stable across renders
function seedRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

interface SquareState {
  x: number; y: number;
  size: number;
  color: string;
  colorTarget: string;
  colorProgress: number;
  colorSpeed: number;
  vy: number;        // vertical drift speed
  phase: number;     // sine wave phase offset
  amp: number;       // vertical oscillation amplitude
  rotY: number;      // current Y rotation (flip)
  rotSpeed: number;  // flip speed
  opacity: number;
  opacityTarget: number;
  opacitySpeed: number;
  borderRadius: number;
  borderRadiusTarget: number;
  borderRadiusSpeed: number;
}

const SQUARE_SIZE = 32;
const GAP = 10;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lerpColor(a: string, b: string, t: number) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const r = Math.round(lerp(ca.r, cb.r, t));
  const g = Math.round(lerp(ca.g, cb.g, t));
  const bl = Math.round(lerp(ca.b, cb.b, t));
  return `rgb(${r},${g},${bl})`;
}

function AnimatedSquaresBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SquareState[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    function makeSquare(i: number): SquareState {
      const rand = seedRand(i * 97 + 13);
      const color = PALETTE[Math.floor(rand() * PALETTE.length)];
      return {
        x: 0,
        y: 0,
        size: SQUARE_SIZE,
        color,
        colorTarget: PALETTE[Math.floor(rand() * PALETTE.length)],
        colorProgress: rand(),
        colorSpeed: rand() * 0.003 + 0.001,
        vy: (rand() - 0.5) * 0.15,
        phase: rand() * Math.PI * 2,
        amp: rand() * 18 + 6,
        rotY: rand() * 360,
        rotSpeed: (rand() - 0.5) * 0.6,
        opacity: rand() * 0.35 + 0.08,
        opacityTarget: rand() * 0.35 + 0.08,
        opacitySpeed: rand() * 0.003 + 0.001,
        borderRadius: rand() * 6 + 2,
        borderRadiusTarget: rand() * 14 + 2,
        borderRadiusSpeed: rand() * 0.004 + 0.001,
      };
    }

    // Pre-seed enough for a 1920×1080 viewport
    const initialCount = Math.ceil(1920 / (SQUARE_SIZE + GAP) + 1) * Math.ceil(1080 / (SQUARE_SIZE + GAP) + 1);
    stateRef.current = Array.from({ length: initialCount }, (_, i) => makeSquare(i));
    resize();
    window.addEventListener('resize', resize);

    let t = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;

      const cols = Math.ceil(W / (SQUARE_SIZE + GAP)) + 1;
      const rows = Math.ceil(H / (SQUARE_SIZE + GAP)) + 1;
      const total = cols * rows;

      // Grow state array if canvas got larger
      while (stateRef.current.length < total) {
        stateRef.current.push(makeSquare(stateRef.current.length));
      }

      ctx.clearRect(0, 0, W, H);

      stateRef.current.slice(0, total).forEach((sq, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Animate color
        sq.colorProgress += sq.colorSpeed;
        if (sq.colorProgress >= 1) {
          sq.color = sq.colorTarget;
          sq.colorTarget = PALETTE[Math.floor(Math.random() * PALETTE.length)];
          sq.colorProgress = 0;
        }

        // Animate opacity
        sq.opacity = lerp(sq.opacity, sq.opacityTarget, sq.opacitySpeed * 4);
        if (Math.abs(sq.opacity - sq.opacityTarget) < 0.005) {
          sq.opacityTarget = Math.random() * 0.35 + 0.05;
        }

        // Animate border radius
        sq.borderRadius = lerp(sq.borderRadius, sq.borderRadiusTarget, sq.borderRadiusSpeed * 3);
        if (Math.abs(sq.borderRadius - sq.borderRadiusTarget) < 0.5) {
          sq.borderRadiusTarget = Math.random() * 14 + 2;
        }

        // Vertical float
        sq.phase += 0.008;
        const floatY = Math.sin(sq.phase) * sq.amp;

        // Flip rotation
        sq.rotY += sq.rotSpeed;

        const baseX = col * (SQUARE_SIZE + GAP) + SQUARE_SIZE / 2;
        const baseY = row * (SQUARE_SIZE + GAP) + SQUARE_SIZE / 2 + floatY;

        // ScaleX from rotation gives the flip illusion
        const scaleX = Math.cos((sq.rotY * Math.PI) / 180);
        const absScaleX = Math.abs(scaleX);
        const displayColor = scaleX >= 0
          ? lerpColor(sq.color, sq.colorTarget, sq.colorProgress)
          : lerpColor(sq.colorTarget, sq.color, sq.colorProgress);

        const half = sq.size / 2;
        const r = sq.borderRadius;
        const w = sq.size * absScaleX;

        if (w < 0.5) { return; }

        ctx.save();
        ctx.globalAlpha = sq.opacity;
        ctx.fillStyle = displayColor;

        // Rounded rect centered at (baseX, baseY) with width w
        const x0 = baseX - w / 2;
        const y0 = baseY - half;
        ctx.beginPath();
        ctx.roundRect(x0, y0, w, sq.size, r * absScaleX);
        ctx.fill();
        ctx.restore();
      });

      t++;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        display: 'block',
      }}
    />
  );
}

export default function Landing() {
  return (
    <div style={{ background: '#09090e', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Full-viewport animated hero */}
      <section style={{
        position: 'relative',
        minHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Animated square field */}
        <AnimatedSquaresBg />

        {/* Radial vignette so text stays readable */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, transparent 0%, #09090e 75%)',
          pointerEvents: 'none',
        }} />

        {/* Foreground content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          padding: '0 24px', maxWidth: 760,
        }}>
          <div className="tag-green" style={{ marginBottom: 20, fontSize: 10 }}>
            <span className="dot-green" />
            AGENT POPULATION TESTING
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 5.5vw, 72px)',
            fontWeight: 700,
            lineHeight: 1.08,
            color: '#e8eaf0',
            letterSpacing: '-0.04em',
            margin: '0 0 24px',
          }}>
            Build a population of sandboxed customer agents
          </h1>

          <p style={{
            color: '#6b7280', fontSize: 17, lineHeight: 1.7,
            margin: '0 0 40px', maxWidth: 520,
          }}>
            Test websites, journeys and ideas with realistic agent populations before launch. See where people succeed, hesitate and get blocked.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 56 }}>
            <Link to="/signin" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: 15, padding: '11px 28px' }}>Get started</button>
            </Link>
            <Link to="/signin" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ fontSize: 15, padding: '11px 28px' }}>Sign in</button>
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 36, color: '#4b5563', fontSize: 12 }}>
            <span>No credit card required</span>
            <span>Populations in minutes</span>
            <span>Privacy-first</span>
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section style={{ borderTop: '1px solid #1e2230', padding: '60px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {[
              { title: 'Parallel by default', body: 'Run hundreds of customers at once at any stage of your customer journey.' },
              { title: 'Observe every action', body: 'Inspect the sessions and events from every single agent in real time.' },
              { title: 'Decide with evidence', body: 'Turn patterns into clear actions based on real population-level data.' },
            ].map(f => (
              <div key={f.title}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
