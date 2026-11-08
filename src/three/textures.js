import * as THREE from 'three';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finish(canvas, { repeat = null, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

const FONT = '"Nunito", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

/** Tall printed scale for the demo thermometer, 20–50 °C. */
export function makeScaleTexture(min = 20, max = 50) {
  const { canvas, ctx } = makeCanvas(512, 2048);
  const w = canvas.width;
  const h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#eefaff');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, '#dff4fd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(7,42,64,0.18)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  const padTop = 54;
  const padBottom = 54;
  const yOf = (v) => padTop + ((max - v) / (max - min)) * (h - padTop - padBottom);

  for (let v = min; v <= max; v++) {
    const y = yOf(v);
    const major = v % 5 === 0;
    ctx.strokeStyle = major ? '#0a2d43' : 'rgba(10,45,67,0.55)';
    ctx.lineWidth = major ? 7 : 4;
    ctx.beginPath();
    ctx.moveTo(major ? 150 : 240, y);
    ctx.lineTo(486, y);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#0a2d43';
      ctx.font = `900 62px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), 128, y + 2);
    }
  }

  ctx.save();
  ctx.translate(48, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(10,45,67,0.6)';
  ctx.font = `900 28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '8px';
  ctx.fillText('DEGREES CELSIUS', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#0a2d43';
  ctx.font = `900 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('°C', 64, 44);

  return finish(canvas, { anisotropy: 16 });
}

/** A small printed nameplate / sign. */
export function makeLabelTexture({ title, sub = '', accent = '#22b8d6', dark = false, width = 640, height = 220 }) {
  const { canvas, ctx } = makeCanvas(width, height);
  const rad = 28;
  const bg = dark ? '#071d2d' : '#f8fdff';
  const ink = dark ? '#eaf8ff' : '#08243a';
  const soft = dark ? '#9cc4da' : '#527387';

  ctx.beginPath();
  ctx.roundRect(6, 6, width - 12, height - 12, rad);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = dark ? 'rgba(167,221,244,0.25)' : 'rgba(8,36,58,0.12)';
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(34, 36, 10, height - 72, 5);
  ctx.fill();

  ctx.fillStyle = ink;
  ctx.font = `900 ${sub ? 58 : 64}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 70, sub ? height * 0.42 : height * 0.5);
  if (sub) {
    ctx.fillStyle = soft;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(sub, 72, height * 0.7);
  }
  return finish(canvas);
}

/** Digital stopwatch face. */
export function makeClockTexture() {
  const { canvas, ctx } = makeCanvas(560, 320);
  const texture = finish(canvas);
  const draw = ({ time = '0:00', label = 'MIN : SEC', next = '', tone = '#6ee7f9' } = {}) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0d2a3e');
    grad.addColorStop(1, '#041420');
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 32);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(110,231,249,0.22)';
    ctx.stroke();

    ctx.fillStyle = tone;
    ctx.font = `900 170px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = tone;
    ctx.shadowBlur = 24;
    ctx.fillText(time, canvas.width / 2, 142);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(200,235,250,0.55)';
    ctx.font = `900 26px ${FONT}`;
    ctx.fillText(label, canvas.width / 2, 244);

    if (next) {
      ctx.fillStyle = '#ffc95c';
      ctx.font = `900 24px ${FONT}`;
      ctx.fillText(next, canvas.width / 2, 288);
    }
    texture.needsUpdate = true;
  };
  draw();
  return { texture, draw };
}

/** Soft round sprite used for snow and steam. */
export function makeSoftCircleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const { canvas, ctx } = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(canvas);
}

/** Snowy ground texture, subtle enough not to fight the low-poly look. */
export function makeSnowTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#e8f7ff';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const a = Math.random() * 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(110,180,214,${a * 0.7})`;
    const r = 1 + Math.random() * 9;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = `rgba(120,180,210,${0.04 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(canvas, { repeat: [5, 5], anisotropy: 8 });
}

/** Frosted glass texture for the table plaque. */
export function makeWoodTexture() {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = '#c7a47a';
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(90,55,30,${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(160, y + (Math.random() - 0.5) * 18, 340, y + (Math.random() - 0.5) * 18, 512, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }
  return finish(canvas, { repeat: [2, 1] });
}
