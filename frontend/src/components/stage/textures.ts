import { useEffect, useState } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Paints a canvas texture and tells three.js to upload it again. */
function paintTexture(texture: CanvasTexture, draw: Draw, width: number, height: number) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  texture.needsUpdate = true;
}

/**
 * A canvas texture that is drawn once, then redrawn as soon as the page's web
 * fonts have loaded (canvas text otherwise falls back to a system font).
 */
export function useCanvasTexture(
  width: number,
  height: number,
  draw: Draw,
  fonts: string[] = [],
  options: { repeat?: boolean; srgb?: boolean } = {}
) {
  const [texture] = useState(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const created = new CanvasTexture(canvas);
    if (options.srgb !== false) created.colorSpace = SRGBColorSpace;
    if (options.repeat) {
      created.wrapS = RepeatWrapping;
      created.wrapT = RepeatWrapping;
    }
    created.anisotropy = 8;
    return created;
  });

  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      if (!cancelled) paintTexture(texture, draw, width, height);
    };
    paint();
    Promise.all(fonts.map((font) => document.fonts.load(font).catch(() => [])))
      .then(paint)
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Redraw only when the inputs that change the picture change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, width, height, ...fonts, draw]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

export const PAPER = "#F3F0E7";
export const INK = "#172940";
export const NIGHT = "#0E1B2C";
export const CORAL = "#EE6845";
export const LIME = "#D6F36B";

export const DISPLAY_FONT = '"Bricolage Grotesque Variable", "Geist Variable", sans-serif';
export const UI_FONT = '"Geist Variable", system-ui, sans-serif';
export const NASTALIQ_FONT = '"Noto Nastaliq Urdu", serif';

/** Combination dial face: ticks, the four day presets and a small caption. */
export function drawDialFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;

  const gradient = ctx.createRadialGradient(cx, cy * 0.8, r * 0.1, cx, cy, r);
  gradient.addColorStop(0, "#FBF9F3");
  gradient.addColorStop(1, "#E6DFCC");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 100 ticks; every tenth is long.
  ctx.strokeStyle = INK;
  for (let i = 0; i < 100; i++) {
    const angle = (i / 100) * Math.PI * 2;
    const long = i % 25 === 0 ? 0.2 : i % 5 === 0 ? 0.12 : 0.06;
    ctx.lineWidth = i % 25 === 0 ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(angle) * r * 0.94, cy - Math.cos(angle) * r * 0.94);
    ctx.lineTo(cx + Math.sin(angle) * r * (0.94 - long), cy - Math.cos(angle) * r * (0.94 - long));
    ctx.stroke();
  }

  // Preset labels at 12, 3, 6 and 9 o'clock.
  const labels = ["30", "60", "90", "180"];
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach((label, index) => {
    const angle = (index / labels.length) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.sin(angle) * r * 0.55, cy - Math.cos(angle) * r * 0.55);
    ctx.rotate(angle);
    ctx.font = `700 ${Math.round(r * 0.2)}px ${DISPLAY_FONT}`;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  ctx.font = `600 ${Math.round(r * 0.075)}px ${UI_FONT}`;
  ctx.fillStyle = "#5D6D7C";
  ctx.fillText("DAYS", cx, cy + r * 0.2);

  // Inner ring.
  ctx.strokeStyle = "#C9C2AF";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

/** وارث ("heir") in Nastaliq, engraved on the plaque above the door. */
export function drawPlaque(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = PAPER;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.font = `700 ${Math.round(h * 0.42)}px ${NASTALIQ_FONT}`;
  ctx.shadowColor = "rgba(243,240,231,0.55)";
  ctx.shadowBlur = h * 0.06;
  ctx.fillText("وارث", w / 2, h * 0.5);
}

/** Coin face with the Ethereum diamond, tinted per asset. */
export function makeCoinFaceDrawer(color: string, symbol: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2;
    const gradient = ctx.createRadialGradient(cx * 0.8, cy * 0.7, r * 0.1, cx, cy, r);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, color);
    gradient.addColorStop(1, "#3c4a5e");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(23,41,64,0.55)";
    ctx.lineWidth = w * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    if (symbol === "ETH") {
      // Ethereum diamond: an upper and a lower half.
      ctx.fillStyle = "rgba(23,41,64,0.85)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.32, cy + r * 0.02);
      ctx.lineTo(cx, cy + r * 0.18);
      ctx.lineTo(cx - r * 0.32, cy + r * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.26);
      ctx.lineTo(cx + r * 0.32, cy + r * 0.1);
      ctx.lineTo(cx, cy + r * 0.56);
      ctx.lineTo(cx - r * 0.32, cy + r * 0.1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(23,41,64,0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(r * 0.42)}px ${DISPLAY_FONT}`;
      ctx.fillText(symbol.slice(0, 4), cx, cy);
    }
  };
}

/** Heir medallion face: the share in big numerals. */
export function makeMedallionDrawer(share: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = w * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(r * 0.62)}px ${DISPLAY_FONT}`;
    ctx.fillText(`${share}`, cx - r * 0.08, cy + r * 0.04);
    ctx.font = `700 ${Math.round(r * 0.28)}px ${DISPLAY_FONT}`;
    ctx.fillText("%", cx + r * 0.46, cy + r * 0.16);
  };
}

/** Wax seal face: a pressed ring with the W monogram. */
export function drawSealFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  const gradient = ctx.createRadialGradient(cx * 0.85, cy * 0.75, r * 0.1, cx, cy, r);
  gradient.addColorStop(0, "#FF8A68");
  gradient.addColorStop(0.6, CORAL);
  gradient.addColorStop(1, "#B8462D");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(120,35,18,0.55)";
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(120,35,18,0.7)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(r * 0.8)}px ${DISPLAY_FONT}`;
  ctx.fillText("W", cx, cy + r * 0.05);
}

/** Soft stripes used as a moving alpha map on the heir ribbons ("flowing light"). */
export function drawStripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, "rgb(40,40,40)");
  gradient.addColorStop(0.45, "rgb(255,255,255)");
  gradient.addColorStop(0.55, "rgb(255,255,255)");
  gradient.addColorStop(1, "rgb(40,40,40)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** The inside of the vault: dark at the back, lighter toward the rim. */
export function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const gradient = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w / 2);
  gradient.addColorStop(0, "#02060B");
  gradient.addColorStop(0.55, "#071221");
  gradient.addColorStop(0.86, "#10233A");
  gradient.addColorStop(1, "#1C3350");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  // Faint concentric grooves give the tunnel depth.
  ctx.strokeStyle = "rgba(214,243,107,0.05)";
  ctx.lineWidth = 2;
  for (let r = w * 0.18; r < w / 2; r += w * 0.06) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
