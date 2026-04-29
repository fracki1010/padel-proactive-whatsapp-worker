const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 600;
const COLOR_BG = "#0f1923";
const COLOR_ACCENT = "#c8f135";

const roundRect = (ctx, x, y, w, h, r) => {
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

const formatPhone = (raw = "") => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 10) {
    const local = digits.replace(/^549?/, "");
    if (local.length === 10) return `${local.slice(0, 4)} ${local.slice(4)}`;
    return local;
  }
  return digits;
};

// "x2  I" / "O" / "x3" depending on count and type
const buildIndicator = (count, isIndoor) => {
  const type = isIndoor === true ? "I" : isIndoor === false ? "O" : "";
  const countPart = count > 1 ? `x${count}` : "";
  return [countPart, type].filter(Boolean).join("  ");
};

const buildDigestImage = async (entries = [], dateLabel = "", backgroundUrl = null, clubName = "", botPhone = "") => {
  const PILL_H = 62;
  const PILL_GAP = 14;
  const PILL_W = 270;
  const PILL_R = PILL_H / 2;

  // Fixed vertical positions (baselines)
  const weekdayY = 95;          // "MARTES" baseline
  const title1Y = weekdayY + 65; // "TURNOS" baseline  (60px font → ~65px gap)
  const title2Y = title1Y + 68;  // "LIBRES" baseline
  const pillsTop = title2Y + 58; // first pill top

  const slotCount = Math.max(entries.length, 1);
  const slotsH = slotCount * (PILL_H + PILL_GAP) - PILL_GAP;
  const FOOTER_H = 80;
  const BOTTOM_PAD = 46;

  const canvasHeight = pillsTop + slotsH + FOOTER_H + BOTTOM_PAD;

  const canvas = createCanvas(WIDTH, canvasHeight);
  const ctx = canvas.getContext("2d");

  // ── Background ─────────────────────────────────────────────────────────────
  if (backgroundUrl) {
    try {
      const bgImage = await loadImage(backgroundUrl);
      const scale = Math.max(WIDTH / bgImage.width, canvasHeight / bgImage.height);
      const bw = bgImage.width * scale;
      const bh = bgImage.height * scale;
      ctx.drawImage(bgImage, (WIDTH - bw) / 2, (canvasHeight - bh) / 2, bw, bh);
      ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
      ctx.fillRect(0, 0, WIDTH, canvasHeight);
    } catch {
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, WIDTH, canvasHeight);
    }
  } else {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, WIDTH, canvasHeight);
  }

  ctx.textAlign = "center";

  // ── Weekday (e.g. "MARTES") ────────────────────────────────────────────────
  const weekday = String(dateLabel || "").split(",")[0].trim().toUpperCase() || "HOY";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(weekday, WIDTH / 2, weekdayY);

  // ── "TURNOS LIBRES" ────────────────────────────────────────────────────────
  ctx.fillStyle = COLOR_ACCENT;
  ctx.font = "bold 62px sans-serif";
  ctx.fillText("TURNOS", WIDTH / 2, title1Y);
  ctx.fillText("LIBRES", WIDTH / 2, title2Y);

  // ── Slot pills ─────────────────────────────────────────────────────────────
  if (!entries.length) {
    roundRect(ctx, (WIDTH - PILL_W) / 2, pillsTop, PILL_W, PILL_H, PILL_R);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Sin turnos disponibles", WIDTH / 2, pillsTop + PILL_H / 2 + 7);
  } else {
    const pillLeft = (WIDTH - PILL_W) / 2;
    const pillRight = pillLeft + PILL_W;

    entries.forEach((entry, i) => {
      const pillY = pillsTop + i * (PILL_H + PILL_GAP);
      const textY = pillY + PILL_H / 2 + 11;

      // pill background
      roundRect(ctx, pillLeft, pillY, PILL_W, PILL_H, PILL_R);
      ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
      ctx.fill();

      const indicator = buildIndicator(entry.count, entry.isIndoor);

      // measure both parts to center them together
      ctx.font = "bold 32px sans-serif";
      const timeW = ctx.measureText(entry.startTime).width;
      ctx.font = "bold 14px sans-serif";
      const indW = indicator ? ctx.measureText(indicator).width : 0;
      const gap = indicator ? 14 : 0;
      const totalW = timeW + gap + indW;
      const startX = WIDTH / 2 - totalW / 2;

      // time text
      ctx.fillStyle = "#111111";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(entry.startTime, startX, textY);

      // indicator inline, smaller, slightly lower for alignment
      if (indicator) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(indicator, startX + timeW + gap, textY);
      }
    });
  }

  ctx.textAlign = "center";

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = canvasHeight - BOTTOM_PAD - FOOTER_H + 18;

  if (botPhone) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(formatPhone(botPhone), WIDTH / 2, footerY);
  }

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 80, footerY + 14);
  ctx.lineTo(WIDTH / 2 + 80, footerY + 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const displayName = clubName ? clubName.toUpperCase() : "PADEL PROACTIVE";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(displayName, WIDTH / 2, footerY + 34);

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
