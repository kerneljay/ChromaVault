// App.tsx (full file with larger wheel)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ---------- Color utilities (unchanged) ----------
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number): string => {
  h = h / 360; s = s / 100; l = l / 100;
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (x: number) => { const hx = Math.round(x * 255).toString(16); return hx.length === 1 ? '0' + hx : hx; };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const hexToRgbString = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
};

const hexToHslString = (hex: string): string => {
  const { h, s, l } = hexToHsl(hex);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
};

const hexToHsvString = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const rp = r / 255, gp = g / 255, bp = b / 255;
  const max = Math.max(rp, gp, bp);
  const min = Math.min(rp, gp, bp);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rp) h = ((gp - bp) / delta) % 6;
    else if (max === gp) h = (bp - rp) / delta + 2;
    else h = (rp - gp) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return `hsv(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(max * 100)}%)`;
};

const generateHarmony = (primaryHex: string, shape: string): string[] => {
  const { h, s, l } = hexToHsl(primaryHex);
  const colors = [primaryHex];
  switch (shape) {
    case 'line':     colors.push(hslToHex((h + 180) % 360, s, l)); break;
    case 'triangle': colors.push(hslToHex((h + 120) % 360, s, l), hslToHex((h + 240) % 360, s, l)); break;
    case 'split':    colors.push(hslToHex((h + 150) % 360, s, l), hslToHex((h + 210) % 360, s, l)); break;
    case 'square':   colors.push(hslToHex((h + 90) % 360, s, l), hslToHex((h + 180) % 360, s, l), hslToHex((h + 270) % 360, s, l)); break;
    case 'penta':    for (let i = 1; i <= 4; i++) colors.push(hslToHex((h + i * 72) % 360, s, l)); break;
    default:         colors.push(hslToHex((h + 180) % 360, s, l));
  }
  while (colors.length < 5) colors.push('#1a1a1a');
  return colors;
};

// ---------- Tick synth (Web Audio) ----------
const audioCtxRef = { current: null as AudioContext | null };

const playTick = (hue: number) => {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const freq = 420 + (hue / 360) * 340;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.08);
  } catch {}
};

type ColorKey = 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary';
type ColorsMap = Record<ColorKey, string>;

const hexToCanvasPos = (hex: string, center: number, radius: number): { x: number; y: number } => {
  const { h, s, l } = hexToHsl(hex);
  const angleRad  = ((h - 90) * Math.PI) / 180;
  const distRatio = (s / 100) * 0.88 + (1 - s / 100) * 0.08;
  const lightOff  = (l - 50) / 50;
  const dist      = radius * Math.max(0.06, Math.min(0.92, distRatio - lightOff * 0.15));
  return { x: center + dist * Math.cos(angleRad), y: center + dist * Math.sin(angleRad) };
};

// ---------- Color Wheel (larger: 560px) ----------
const ColorWheel: React.FC<{
  colors: ColorsMap;
  activeMode: 'harmony' | 'manual';
  onChangeKey: (key: ColorKey, c: string) => void;
}> = ({ colors, activeMode, onChangeKey }) => {
  const baseCanvasRef   = useRef<HTMLCanvasElement>(null);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const draggingKey     = useRef<ColorKey | null>(null);
  const lastTickHue     = useRef<number>(-999);
  const size = 560;                     // ← increased from 480
  const center = size / 2;
  const radius = size / 2 - 2;
  const GRAY_RADIUS_FACTOR = 0.12;
  const grayRadius = radius * GRAY_RADIUS_FACTOR;

  const ALL_KEYS: ColorKey[] = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'];

  // Draw base wheel once
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    for (let angle = 0; angle < 360; angle++) {
      const start = ((angle - 90) * Math.PI) / 180;
      const end   = ((angle - 89) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 55%)`;
      ctx.fill();
    }
    const whiteGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
    whiteGrad.addColorStop(0,    'rgba(255,255,255,1)');
    whiteGrad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
    whiteGrad.addColorStop(0.75, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.fill();
    const darkGrad = ctx.createRadialGradient(center, center, radius * 0.5, center, center, radius);
    darkGrad.addColorStop(0,   'rgba(0,0,0,0)');
    darkGrad.addColorStop(0.8, 'rgba(0,0,0,0)');
    darkGrad.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.fillStyle = darkGrad;
    ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.fill();
    const grayGrad = ctx.createRadialGradient(center, center, 0, center, center, grayRadius);
    grayGrad.addColorStop(0, '#000000');
    grayGrad.addColorStop(0.5, '#777777');
    grayGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grayGrad;
    ctx.beginPath(); ctx.arc(center, center, grayRadius, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(center, center, grayRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [center, radius, size, grayRadius]);

  // Draw markers and connecting lines
  useEffect(() => {
    const canvas = markerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    for (const key of ALL_KEYS) {
      const hex = colors[key];
      if (hex === '#1a1a1a') continue;
      const { x, y } = hexToCanvasPos(hex, center, radius);
      const isPrimary  = key === 'primary';
      const isDraggable = activeMode === 'manual' || isPrimary;
      const r = isPrimary ? 15 : 12;   // slightly larger markers for bigger wheel
      ctx.shadowColor = hex;
      ctx.shadowBlur  = isDraggable ? 22 : 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isDraggable ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = isPrimary ? 2.5 : 1.8;
      if (!isPrimary && activeMode === 'manual') ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
    const activePoints: { key: ColorKey; x: number; y: number }[] = [];
    for (const key of ALL_KEYS) {
      const hex = colors[key];
      if (hex !== '#1a1a1a') {
        const { x, y } = hexToCanvasPos(hex, center, radius);
        activePoints.push({ key, x, y });
      }
    }
    if (activePoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(activePoints[0].x, activePoints[0].y);
      for (let i = 1; i < activePoints.length; i++) {
        ctx.lineTo(activePoints[i].x, activePoints[i].y);
      }
      if (activePoints.length >= 3) {
        ctx.lineTo(activePoints[0].x, activePoints[0].y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }, [colors, center, radius, size, activeMode]);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = markerCanvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      cx: (clientX - rect.left)  * (canvas.width  / rect.width),
      cy: (clientY - rect.top)   * (canvas.height / rect.height),
    };
  }, []);

  const colorAt = useCallback((cx: number, cy: number): string | null => {
    const dx = cx - center, dy = cy - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) return null;
    if (dist < grayRadius) {
      const t = dist / grayRadius;
      const lightness = 20 + t * 60;
      return hslToHex(0, 0, lightness);
    }
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    angle = (angle + 360) % 360;
    const ratio = dist / radius;
    let sat = 100, light = 50;
    if (ratio < 0.5) {
      light = 50 + 50 * (1 - ratio / 0.5);
      sat   = 100 * (ratio / 0.5);
    } else {
      light = 50 * (1 - (ratio - 0.5) / 0.5 * 0.5);
      sat   = 100;
    }
    return hslToHex(angle, Math.min(100, Math.max(0, sat)), Math.min(95, Math.max(10, light)));
  }, [center, radius, grayRadius]);

  const hitTest = useCallback((cx: number, cy: number): ColorKey | null => {
    const GRAB = 28; // increased grab radius for larger wheel
    let best: ColorKey | null = null;
    let bestDist = GRAB;
    const keysToTest: ColorKey[] = activeMode === 'manual'
      ? ALL_KEYS.filter(k => colors[k] !== '#1a1a1a')
      : ['primary'];
    for (const key of keysToTest) {
      const { x, y } = hexToCanvasPos(colors[key], center, radius);
      const d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
      if (d < bestDist) { bestDist = d; best = key; }
    }
    return best;
  }, [activeMode, colors, center, radius]);

  const emitColor = useCallback((key: ColorKey, cx: number, cy: number) => {
    const c = colorAt(cx, cy);
    if (!c) return;
    const { h } = hexToHsl(c);
    const delta = Math.abs(h - lastTickHue.current);
    if (Math.min(delta, 360 - delta) >= 8) {
      playTick(h);
      lastTickHue.current = h;
    }
    onChangeKey(key, c);
  }, [colorAt, onChangeKey]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    const hit = hitTest(cx, cy);
    const key: ColorKey = hit ?? 'primary';
    draggingKey.current = key;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const c = colorAt(cx, cy);
    if (c) {
      const { h } = hexToHsl(c);
      playTick(h);
      lastTickHue.current = h;
      onChangeKey(key, c);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingKey.current) return;
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    emitColor(draggingKey.current, cx, cy);
  };

  const handlePointerUp = () => { draggingKey.current = null; };

  return (
    <div className="wheel-stack">
      <canvas ref={baseCanvasRef} width={size} height={size} className="wheel-canvas base-canvas" />
      <canvas
        ref={markerCanvasRef}
        width={size} height={size}
        className="wheel-canvas marker-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};

// ---------- Icons (unchanged) ----------
const IconExport  = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;
const IconCopy    = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>;
const IconVolume  = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const IconMute    = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>;
const IconDelete  = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const IconSave    = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>;
const IconLink    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>;

const ShapeIcons: Record<string, React.FC> = {
  line:     () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="10" x2="17" y2="10"/></svg>,
  triangle: () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="10,3 17,17 3,17"/></svg>,
  split:    () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3 L10 17 M7 7 L3 10 L7 13 M13 7 L17 10 L13 13"/></svg>,
  square:   () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="12" height="12"/></svg>,
  penta:    () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="10,2 18,8 15,17 5,17 2,8"/></svg>,
};

// ---------- Main App ----------
const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'harmony' | 'manual'>('harmony');
  const [harmonyShape, setHarmonyShape] = useState<'line' | 'triangle' | 'split' | 'square' | 'penta'>('line');
  const [linkMode, setLinkMode] = useState(true);
  const [colors, setColors] = useState({
    primary:    '#C0656B',
    secondary:  '#5BA0A6',
    tertiary:   '#1a1a1a',
    quaternary: '#1a1a1a',
    quinary:    '#1a1a1a',
  });
  const [toast, setToast] = useState('');
  const [presets, setPresets] = useState<Array<{ id: string; name: string; colors: typeof colors }>>(() => {
    try {
      const saved = localStorage.getItem('chromavault_presets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Sunset',  colors: { primary: '#E07A5F', secondary: '#F2CC8F', tertiary: '#3D405B', quaternary: '#81B29A', quinary: '#1a1a1a' } },
      { id: '2', name: 'Ocean',   colors: { primary: '#2C7DA0', secondary: '#61A5C2', tertiary: '#89C2D9', quaternary: '#A9D6E5', quinary: '#1a1a1a' } },
      { id: '3', name: 'Forest',  colors: { primary: '#2D6A4F', secondary: '#40916C', tertiary: '#52B788', quaternary: '#74C69D', quinary: '#1a1a1a' } },
    ];
  });
  const [presetName, setPresetName] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.35);
  const [isMuted, setIsMuted] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const [lastDragKey, setLastDragKey] = useState<ColorKey>('primary');
  const gradientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const targetPos = useRef({ x: 0.5, y: 0.5 });

  // Save presets
  useEffect(() => {
    localStorage.setItem('chromavault_presets', JSON.stringify(presets));
  }, [presets]);

  const applyHarmony = useCallback((primary: string, shape: string) => {
    const harmony = generateHarmony(primary, shape);
    setColors(prev => ({
      ...prev,
      secondary:  harmony[1] ?? prev.secondary,
      tertiary:   harmony[2] ?? prev.tertiary,
      quaternary: harmony[3] ?? prev.quaternary,
      quinary:    harmony[4] ?? prev.quinary,
    }));
  }, []);

  useEffect(() => {
    if (activeMode === 'harmony' || (activeMode === 'manual' && linkMode)) {
      applyHarmony(colors.primary, harmonyShape);
    }
  }, [colors.primary, activeMode, linkMode, harmonyShape, applyHarmony]);

  useEffect(() => {
    if (activeMode === 'harmony' || (activeMode === 'manual' && linkMode)) {
      applyHarmony(colors.primary, harmonyShape);
    }
  }, [harmonyShape, activeMode, linkMode, colors.primary, applyHarmony]);

  useEffect(() => {
    if (activeMode === 'harmony' || (activeMode === 'manual' && linkMode)) {
      applyHarmony(colors.primary, harmonyShape);
    }
  }, [activeMode, linkMode, colors.primary, harmonyShape, applyHarmony]);

  // Ambient audio
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/sounds/ambient.mp3');
      audio.loop = true;
      audio.volume = isMuted ? 0 : volume;
      audio.play().catch(() => {});
      audioRef.current = audio;
    }
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      if (!isMuted && volume > 0 && audioRef.current.paused) audioRef.current.play().catch(() => {});
    }
  }, [volume, isMuted]);

  // Click outside copy dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const handleColorKeyChange = useCallback((key: ColorKey, val: string) => {
    setLastDragKey(key);
    setColors(prev => ({ ...prev, [key]: val }));
  }, []);

  const getActiveColors = useCallback((): string[] => {
    return (Object.values(colors) as string[]).filter(c => c !== '#1a1a1a');
  }, [colors]);

  // Copy functions
  const copyAsHex = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    navigator.clipboard.writeText(active.join('\n'));
    showToast(`Copied ${active.length} color(s) as HEX`);
  };
  const copyAsRgb = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    navigator.clipboard.writeText(active.map(hex => hexToRgbString(hex)).join('\n'));
    showToast(`Copied ${active.length} color(s) as RGB`);
  };
  const copyAsHsv = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    navigator.clipboard.writeText(active.map(hex => hexToHsvString(hex)).join('\n'));
    showToast(`Copied ${active.length} color(s) as HSV`);
  };
  const copyAsHsl = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    navigator.clipboard.writeText(active.map(hex => hexToHslString(hex)).join('\n'));
    showToast(`Copied ${active.length} color(s) as HSL`);
  };
  const copyAsCssVars = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    const varStrings = active.map((hex, idx) => `  --color-${idx + 1}: ${hex};`);
    navigator.clipboard.writeText(`:root {\n${varStrings.join('\n')}\n}`);
    showToast(`Copied ${active.length} color(s) as CSS variables`);
  };
  const copyMidjourney = () => {
    const active = getActiveColors();
    if (active.length === 0) return;
    navigator.clipboard.writeText(`/imagine prompt --palette ${active.join(', ')}`);
    showToast('Midjourney prompt copied ✓');
  };

  const exportImage = () => {
    const activeColors = getActiveColors();
    const count = activeColors.length;
    const W = 1200, H = 520;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0d0d0d');
    bgGrad.addColorStop(1, '#141414');
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '700 11px monospace';
    ctx.fillText('◈  CHROMAVAULT', 44, 52);
    const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '400 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 44, 52);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(44, 66); ctx.lineTo(W - 44, 66); ctx.stroke();
    const swatchTop = 96, swatchH = 240, swatchRadius = 16, gap = 16;
    const totalW = W - 88;
    const swatchW = Math.floor((totalW - gap * (count - 1)) / count);
    const startX = 44;
    activeColors.forEach((hex, i) => {
      const x = startX + i * (swatchW + gap);
      const y = swatchTop;
      ctx.shadowColor = hex;
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = hex;
      roundRect(ctx, x, y, swatchW, swatchH, swatchRadius);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const gloss = ctx.createLinearGradient(x, y, x, y + swatchH * 0.55);
      gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      roundRect(ctx, x, y, swatchW, swatchH * 0.55, swatchRadius);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, swatchW, swatchH, swatchRadius);
      ctx.stroke();
      const labelY = swatchTop + swatchH + 18, labelH = 66;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, x, labelY, swatchW, labelH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, x, labelY, swatchW, labelH, 10);
      ctx.stroke();
      ctx.fillStyle = hex;
      ctx.shadowColor = hex;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x + 18, labelY + labelH / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${count <= 3 ? 15 : 13}px monospace`;
      ctx.fillText(hex.toUpperCase(), x + 32, labelY + labelH / 2 - 5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '400 10px monospace';
      ctx.fillText(`0${i + 1}`, x + 33, labelY + labelH / 2 + 12);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '400 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CHROMAVAULT  ·  ${activeColors.map(c => c.toUpperCase()).join('  ·  ')}`, W / 2, H - 24);
    const slug = activeColors.map(c => c.replace('#', '').toLowerCase()).join('-');
    const link = document.createElement('a');
    link.download = `chromavault-${slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Palette exported ✓');
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const savePreset = () => {
    const name = presetName.trim() || `Palette ${presets.length + 1}`;
    setPresets(prev => [...prev, { id: Date.now().toString(), name, colors: { ...colors } }]);
    setPresetName('');
    showToast(`"${name}" saved`);
  };
  const deletePreset = (id: string) => setPresets(prev => prev.filter(p => p.id !== id));
  const loadPreset = (c: typeof colors) => { setColors(c); showToast('Palette loaded'); };

  // Dynamic gradient background effect
  useEffect(() => {
    const canvas = gradientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frameId: number;
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    const handleMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX / width, y: e.clientY / height };
    };
    const draw = () => {
      if (!ctx) return;
      mousePos.current.x += (targetPos.current.x - mousePos.current.x) * 0.08;
      mousePos.current.y += (targetPos.current.y - mousePos.current.y) * 0.08;
      const cx = mousePos.current.x * width;
      const cy = mousePos.current.y * height;
      const activeColors = getActiveColors();
      if (activeColors.length === 0) return;
      ctx.clearRect(0, 0, width, height);
      const numColors = Math.min(activeColors.length, 5);
      for (let i = 0; i < numColors; i++) {
        const color = activeColors[i];
        const angle = (i / numColors) * Math.PI * 2;
        const radiusOffset = 150;
        const offsetX = Math.cos(angle) * radiusOffset * (mousePos.current.x * 0.8 + 0.2);
        const offsetY = Math.sin(angle) * radiusOffset * (mousePos.current.y * 0.8 + 0.2);
        const grad = ctx.createRadialGradient(
          cx + offsetX, cy + offsetY, 20,
          cx + offsetX - 40, cy + offsetY - 40, 280
        );
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, color + 'aa');
        grad.addColorStop(1, color + '00');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      if (activeColors[0]) {
        const grad2 = ctx.createRadialGradient(cx, cy, 10, cx, cy, 220);
        grad2.addColorStop(0, activeColors[0]);
        grad2.addColorStop(0.7, activeColors[0] + '80');
        grad2.addColorStop(1, '#00000000');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);
      }
      frameId = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();
    draw();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [getActiveColors]);

  const harmonyShapes = [
    { key: 'line' as const, label: 'Complement', count: '2' },
    { key: 'triangle' as const, label: 'Triadic', count: '3' },
    { key: 'split' as const, label: 'Split', count: 'Split' },
    { key: 'square' as const, label: 'Tetradic', count: '4' },
    { key: 'penta' as const, label: 'Pentadic', count: '5' },
  ];
  const colorEntries: { key: keyof typeof colors; label: string }[] = [
    { key: 'primary', label: '01' },
    { key: 'secondary', label: '02' },
    { key: 'tertiary', label: '03' },
    { key: 'quaternary', label: '04' },
    { key: 'quinary', label: '05' },
  ];
  const activeColorCount = Object.values(colors).filter(c => c !== '#1a1a1a').length;

  return (
    <div className="app">
      <canvas ref={gradientCanvasRef} className="gradient-canvas" />
      <div className="bg-noise" />
      <div className="cv-page">
        <header className="cv-header">
          <div className="cv-brand">
            <span className="cv-gem">◈</span>
            <h1 className="cv-title">CHROMAVAULT</h1>
          </div>
          <div className="cv-header-actions">
            <button className="cv-btn" onClick={exportImage}><IconExport /> <span>Export</span></button>
            <div className="copy-dropdown" ref={copyMenuRef}>
              <button className="cv-btn" onClick={() => setCopyMenuOpen(!copyMenuOpen)}><IconCopy /> <span>Copy as</span></button>
              {copyMenuOpen && (
                <div className="dropdown-menu">
                  <button onClick={() => { copyAsHex(); setCopyMenuOpen(false); }}>📋 HEX</button>
                  <button onClick={() => { copyAsRgb(); setCopyMenuOpen(false); }}>🎨 RGB</button>
                  <button onClick={() => { copyAsHsv(); setCopyMenuOpen(false); }}>🌈 HSV</button>
                  <button onClick={() => { copyAsHsl(); setCopyMenuOpen(false); }}>🎨 HSL</button>
                  <button onClick={() => { copyAsCssVars(); setCopyMenuOpen(false); }}>📄 CSS Variables</button>
                  <button onClick={() => { copyMidjourney(); setCopyMenuOpen(false); }}>🤖 Midjourney Prompt</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="cv-main">
          <aside className="cv-sidebar">
            <div className="sidebar-label">SAVED PALETTES</div>
            <div className="sidebar-save">
              <input className="sidebar-input" type="text" placeholder="Name this palette…" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} />
              <button className="sidebar-save-btn" onClick={savePreset}><IconSave /></button>
            </div>
            <div className="sidebar-list">
              {presets.length === 0 && <div className="sidebar-empty">No palettes saved yet</div>}
              {presets.map(preset => (
                <div key={preset.id} className="sidebar-preset" onClick={() => loadPreset(preset.colors)}>
                  <div className="sidebar-swatches">
                    {Object.values(preset.colors).slice(0, 5).map((c, i) => (
                      <div key={i} className="sidebar-swatch" style={{ background: c === '#1a1a1a' ? '#2a2a2a' : c }} />
                    ))}
                  </div>
                  <span className="sidebar-preset-name">{preset.name}</span>
                  <button className="sidebar-delete" onClick={e => { e.stopPropagation(); deletePreset(preset.id); }}><IconDelete /></button>
                </div>
              ))}
            </div>
          </aside>
          <div className="cv-wheel-area">
            <div className="wheel-ring">
              <ColorWheel colors={colors} activeMode={activeMode} onChangeKey={handleColorKeyChange} />
            </div>
            <div className="wheel-badge">
              <div className="badge-swatch" style={{ background: colors[lastDragKey] }} />
              <span className="badge-hex">{colors[lastDragKey].toUpperCase()}</span>
              <span className="badge-count">{lastDragKey.slice(0,3).toUpperCase()} · {activeColorCount} color{activeColorCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="cv-controls">
          <div className="ctrl-section ctrl-mode">
            <div className="mode-pill">
              <button className={`mode-opt ${activeMode === 'harmony' ? 'active' : ''}`} onClick={() => setActiveMode('harmony')}>Harmony</button>
              <button className={`link-toggle ${linkMode ? 'linked' : ''}`} onClick={() => setLinkMode(l => !l)}><IconLink /></button>
              <button className={`mode-opt ${activeMode === 'manual' ? 'active' : ''}`} onClick={() => setActiveMode('manual')}>Manual</button>
            </div>
          </div>
          <div className="ctrl-section ctrl-shapes">
            {harmonyShapes.map(({ key, _, count }) => {
              const Icon = ShapeIcons[key];
              return (
                <button key={key} className={`shape-pill ${harmonyShape === key ? 'active' : ''}`} onClick={() => setHarmonyShape(key)}>
                  <Icon /><span>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="ctrl-section ctrl-swatches">
            {colorEntries.map(({ key, label }) => {
              const hex = colors[key];
              const empty = hex === '#1a1a1a';
              return (
                <div key={key} className={`swatch-chip ${empty ? 'empty' : ''}`} onClick={async () => { if (!empty) { await navigator.clipboard.writeText(hex); showToast(`${hex.toUpperCase()} copied`); } }}>
                  <div className="chip-color" style={{ background: empty ? '#222' : hex }} />
                  <div className="chip-info"><span className="chip-label">{label}</span><span className="chip-hex">{empty ? '——' : hex.toUpperCase()}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="cv-volume">
        <button className="vol-btn" onClick={() => setIsMuted(m => !m)}>{isMuted ? <IconMute /> : <IconVolume />}</button>
        <input className="vol-slider" type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (v === 0) setIsMuted(true); else if (isMuted) setIsMuted(false); }} />
      </div>
      {toast && <div className="cv-toast">{toast}</div>}
    </div>
  );
};

export default App;