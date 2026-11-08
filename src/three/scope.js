import { SIM, apparentReading, clamp } from '../../logic.js';

const W = 360;
const H = 900;
const PAD_TOP = 72;
const PAD_BOTTOM = 80;
const MIN = SIM.thermometerMin;
const MAX = SIM.thermometerMax;

/** Canvas "what your eye sees" view of the thermometer. */
export class ThermometerScope {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.last = null;
  }

  yOf(temp) {
    return PAD_TOP + ((MAX - temp) / (MAX - MIN)) * (H - PAD_TOP - PAD_BOTTOM);
  }

  draw({ trueTemp, elevation = 0, tint = '#ff4b55', showLevelHint = true } = {}) {
    const ctx = this.ctx;
    const apparent = apparentReading(trueTemp, elevation);
    const level = Math.abs(elevation) <= SIM.eyeLevelToleranceDeg;
    this.last = { trueTemp, elevation, apparent, level };
    this.canvas.dataset.level = String(level);
    this.canvas.dataset.elevation = String(elevation);
    this.canvas.dataset.apparent = apparent.toFixed(2);

    ctx.clearRect(0, 0, W, H);

    // Glass body
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#fbfeff');
    bg.addColorStop(0.55, '#eefaff');
    bg.addColorStop(1, '#d8f2fd');
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 26);
    ctx.fillStyle = bg;
    ctx.fill();

    // Inner edge
    ctx.beginPath();
    ctx.roundRect(5, 5, W - 10, H - 10, 22);
    ctx.strokeStyle = 'rgba(7,42,64,0.16)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Header
    ctx.fillStyle = '#0a2d43';
    ctx.font = '900 23px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('READING SCOPE', 24, 38);
    ctx.fillStyle = '#4b7186';
    ctx.font = '800 14px "Nunito", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('°C', W - 24, 38);

    // Scale ticks
    for (let v = MIN; v <= MAX; v++) {
      const y = this.yOf(v);
      const major = v % 5 === 0;
      ctx.strokeStyle = major ? '#0a2d43' : 'rgba(10,45,67,0.48)';
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(major ? 142 : 176, y);
      ctx.lineTo(238, y);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#0a2d43';
        ctx.font = '900 26px "Nunito", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), 128, y + 1);
      }
    }
    ctx.textBaseline = 'alphabetic';

    // Glass tube
    const tubeX = 270;
    ctx.beginPath();
    ctx.roundRect(tubeX - 18, 54, 36, H - 104, 18);
    ctx.fillStyle = 'rgba(180,230,248,0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,45,67,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bulb
    const bulbY = H - 62;
    ctx.beginPath();
    ctx.arc(tubeX, bulbY, 27, 0, Math.PI * 2);
    ctx.fillStyle = '#e83445';
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,45,67,0.12)';
    ctx.stroke();

    // Column up to the apparent reading
    const yTop = clamp(this.yOf(apparent), 58, bulbY - 8);
    const grad = ctx.createLinearGradient(tubeX - 10, 0, tubeX + 10, 0);
    grad.addColorStop(0, '#d92c3d');
    grad.addColorStop(0.45, '#ff5d63');
    grad.addColorStop(0.65, '#ff8b84');
    grad.addColorStop(1, '#cf2638');
    ctx.beginPath();
    ctx.roundRect(tubeX - 9, yTop, 18, bulbY - yTop, 9);
    ctx.fillStyle = grad;
    ctx.fill();

    // Meniscus line (the value the eye currently sees)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = level ? 'rgba(20,150,100,0.85)' : 'rgba(217,44,61,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(124, yTop);
    ctx.lineTo(tubeX + 28, yTop);
    ctx.stroke();
    ctx.setLineDash([]);

    // Meniscus cap
    ctx.beginPath();
    ctx.ellipse(tubeX, yTop, 10, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = level ? '#3fd18d' : '#ff7a72';
    ctx.fill();

    // Eye-level hint: a green line plus tick
    if (showLevelHint && level) {
      ctx.save();
      ctx.shadowColor = 'rgba(63,209,141,0.7)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#25b97d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(84, yTop);
      ctx.lineTo(322, yTop);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#128354';
      ctx.font = '900 17px "Nunito", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('EYE LEVEL ✓', 300, yTop - 12);
    }

    // Glass shine
    const shine = ctx.createLinearGradient(0, 0, W, 0);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.31, 'rgba(255,255,255,0.55)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, W, H);

    // Tint marker for the active cup
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.roundRect(20, H - 34, 44, 7, 4);
    ctx.fill();

    // Little angle caption inside the glass
    const dir = elevation > 0.5 ? 'eye above' : elevation < -0.5 ? 'eye below' : 'level';
    ctx.fillStyle = level ? '#128354' : '#8a5b00';
    ctx.font = '800 14px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dir.toUpperCase(), 76, H - 27);
  }
}
