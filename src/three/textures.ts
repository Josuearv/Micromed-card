import * as THREE from 'three';
import { DuelTelemetry, MedicalClass } from '../types/game';

export function createSurgicalMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(512, 320, 70, 512, 320, 540);
  grad.addColorStop(0, '#0e2836');
  grad.addColorStop(1, '#07141d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Vascular flow channels across the 3 lanes
  const slotX = [272, 512, 752];
  for (const cx of slotX) {
    const chGrad = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0);
    chGrad.addColorStop(0, 'rgba(127, 29, 29, 0)');
    chGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.22)');
    chGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
    ctx.fillStyle = chGrad;
    ctx.fillRect(cx - 80, 36, 160, canvas.height - 72);
  }

  // Calibrated grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Arena calibration border
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.34)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Center membrane divider
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 320);
  ctx.lineTo(canvas.width - 40, 320);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.36)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(512, 320, 86, 0, Math.PI * 2);
  ctx.stroke();

  // 3 vs 3 Biological Lane Pads
  const slotW = 152;
  const slotH = 192;

  ctx.strokeStyle = 'rgba(244, 63, 94, 0.42)';
  ctx.fillStyle = 'rgba(244, 63, 94, 0.07)';
  ctx.lineWidth = 2;
  for (const cx of slotX) {
    ctx.fillRect(cx - slotW / 2, 56, slotW, slotH);
    ctx.strokeRect(cx - slotW / 2, 56, slotW, slotH);
  }

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.46)';
  ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
  for (const cx of slotX) {
    ctx.fillRect(cx - slotW / 2, 392, slotW, slotH);
    ctx.strokeRect(cx - slotW / 2, 392, slotW, slotH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createBrushedMetalRoughnessTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y++) {
    const v = 105 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class VitalMonitorScreen {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;
  private phase = 0;

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
  }

  public update(dt: number, telemetry: DuelTelemetry) {
    const { ctx, canvas } = this;
    const rate = Math.max(0.8, telemetry.bpm / 72);
    this.phase = (this.phase + dt * rate) % 1;

    ctx.fillStyle = '#061119';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(30, 58, 76, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#0c1f2c';
    ctx.fillRect(0, 0, canvas.width, 54);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px "IBM Plex Mono", monospace';
    ctx.fillText('TELEMETRÍA BIOLÓGICA', 22, 34);

    const phaseText =
      telemetry.phase === 'PREPARACION'
        ? 'FASE TÁCTICA'
        : telemetry.phase === 'COMBATE'
          ? 'RESOLVIENDO COMBATE'
          : 'RESPUESTA DEL BROTE';
    ctx.fillStyle =
      telemetry.phase === 'TURNO_RIVAL'
        ? '#f87171'
        : telemetry.phase === 'COMBATE'
          ? '#fbbf24'
          : '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(phaseText, canvas.width - 22, 34);
    ctx.textAlign = 'left';

    const traceTop = 148;
    const traceAmp = 52;
    const isDanger = telemetry.playerLp <= 1200;
    ctx.strokeStyle = isDanger ? '#fb7185' : '#10b981';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const sweepX = this.phase * canvas.width;

    for (let x = 0; x < canvas.width; x += 3) {
      const dist = (sweepX - x + canvas.width) % canvas.width;
      const cycle = (x / 160) % 1;
      let yOffset = 0;
      if (cycle > 0.14 && cycle < 0.22) {
        yOffset = -Math.sin(((cycle - 0.14) / 0.08) * Math.PI) * 0.22;
      } else if (cycle >= 0.28 && cycle < 0.31) {
        yOffset = 0.2;
      } else if (cycle >= 0.31 && cycle < 0.36) {
        yOffset = -1.0 * Math.sin(((cycle - 0.31) / 0.05) * Math.PI);
      } else if (cycle >= 0.36 && cycle < 0.4) {
        yOffset = 0.32;
      } else if (cycle >= 0.52 && cycle < 0.66) {
        yOffset = -Math.sin(((cycle - 0.52) / 0.14) * Math.PI) * 0.34;
      }

      const y = traceTop + yOffset * traceAmp;
      if (dist < 18) {
        ctx.stroke();
        ctx.beginPath();
      } else if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(sweepX, traceTop, 5, 0, Math.PI * 2);
    ctx.fill();

    const spo2Top = 240;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 4) {
      const c = (x / 160) % 1;
      const wave =
        Math.sin(c * Math.PI * 2) * 14 + Math.sin(c * Math.PI * 4 - 0.8) * 6;
      const y = spo2Top - wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#091822';
    ctx.fillRect(0, 290, canvas.width, 94);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "IBM Plex Mono", monospace';
    ctx.fillText('TU LP', 24, 320);
    ctx.fillStyle = isDanger ? '#f87171' : '#34d399';
    ctx.font = '600 34px "IBM Plex Mono", monospace';
    ctx.fillText(String(telemetry.playerLp), 24, 362);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "IBM Plex Mono", monospace';
    ctx.fillText('BROTE LP', 210, 320);
    ctx.fillStyle = '#fb7185';
    ctx.font = '600 34px "IBM Plex Mono", monospace';
    ctx.fillText(String(telemetry.rivalLp), 210, 362);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "IBM Plex Mono", monospace';
    ctx.fillText('FC', 420, 320);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 32px "IBM Plex Mono", monospace';
    ctx.fillText(`${Math.round(telemetry.bpm)}`, 420, 362);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "IBM Plex Mono", monospace';
    ctx.fillText('SpO2', 525, 320);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 32px "IBM Plex Mono", monospace';
    ctx.fillText(`${Math.round(telemetry.spo2)}%`, 525, 362);

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}

const CLASS_HEX: Record<MedicalClass, string> = {
  Inmunologia: '#10b981',
  Farmacologia: '#0ea5e9',
  Cirugia: '#f59e0b',
  Diagnostico: '#38bdf8',
  Patogeno: '#ef4444',
};

export function createPlayedCardTexture(
  medicalClass: MedicalClass,
  title: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const accent = CLASS_HEX[medicalClass];

  ctx.fillStyle = '#0f1b28';
  ctx.fillRect(0, 0, 256, 360);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 340);

  ctx.fillStyle = accent;
  ctx.fillRect(16, 16, 224, 44);

  ctx.fillStyle = '#071018';
  ctx.font = '700 16px "Outfit", sans-serif';
  ctx.fillText(medicalClass.toUpperCase(), 26, 44);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 158, 46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 18px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  const truncated = title.length > 20 ? `${title.slice(0, 18)}…` : title;
  ctx.fillText(truncated, 128, 256);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillText('ACTIVO EN TORRENTE', 128, 304);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCardBackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c1824';
  ctx.fillRect(0, 0, 256, 360);

  ctx.strokeStyle = '#1e3a4c';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 232, 336);

  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 212, 316);

  ctx.fillStyle = '#10b981';
  ctx.fillRect(114, 130, 28, 100);
  ctx.fillRect(78, 166, 100, 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CÓDIGO VITAL', 128, 280);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}
