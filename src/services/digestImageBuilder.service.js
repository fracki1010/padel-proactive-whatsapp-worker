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
    // e.g. 5492622506024 → 2622 506024  (strip country code 54 9)
    const local = digits.replace(/^549?/, "");
    if (local.length === 10) return `${local.slice(0, 4)} ${local.slice(4)}`;
    return local;
  }
  return digits;
};

const buildDigestImage = async (entries = [], dateLabel = "", backgroundUrl = null, clubName = "", botPhone = "") => {
  const PILL_H = 72;
  const PILL_GAP = 18;
  const PILL_W = 260;
  const PILL_R = PILL_H / 2;

  const TOP_PAD = 100;
  const DAY_LABEL_H = 40;    // "MARTES"
  const TITLE_H = 110;       // "TURNOS LIBRES"
  const BEFORE_PILLS = 60;   // gap between title and pills
  const slotCount = Math.max(entries.length, 1);
  const slotsH = slotCount * (PILL_H + PILL_GAP) - PILL_GAP;
  const FOOTER_H = 90;
  const BOTTOM_PAD = 60;

  const canvasHeight =
    TOP_PAD + DAY_LABEL_H + TITLE_H + BEFORE_PILLS + slotsH + FOOTER_H + BOTTOM_PAD;

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

  // ── Weekday label (e.g. "MARTES") ─────────────────────────────────────────
  const weekday = String(dateLabel || "").split(",")[0].trim().toUpperCase() || "HOY";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(weekday, WIDTH / 2, TOP_PAD + DAY_LABEL_H);

  // ── "TURNOS LIBRES" ────────────────────────────────────────────────────────
  ctx.fillStyle = COLOR_ACCENT;
  ctx.font = "bold 80px sans-serif";
  ctx.fillText("TURNOS", WIDTH / 2, TOP_PAD + DAY_LABEL_H + 76);
  ctx.fillText("LIBRES", WIDTH / 2, TOP_PAD + DAY_LABEL_H + 76 + 84);

  // ── Slot pills ─────────────────────────────────────────────────────────────
  const pillsTop = TOP_PAD + DAY_LABEL_H + TITLE_H + BEFORE_PILLS;

  if (!entries.length) {
    roundRect(ctx, (WIDTH - PILL_W) / 2, pillsTop, PILL_W, PILL_H, PILL_R);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Sin turnos disponibles", WIDTH / 2, pillsTop + PILL_H / 2 + 8);
  } else {
    entries.forEach((entry, i) => {
      const pillY = pillsTop + i * (PILL_H + PILL_GAP);
      roundRect(ctx, (WIDTH - PILL_W) / 2, pillY, PILL_W, PILL_H, PILL_R);
      ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.font = "bold 38px sans-serif";
      ctx.fillText(`${entry.startTime}`, WIDTH / 2, pillY + PILL_H / 2 + 13);
    });
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = canvasHeight - BOTTOM_PAD - FOOTER_H + 20;

  // phone number (prominent)
  if (botPhone) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(formatPhone(botPhone), WIDTH / 2, footerY);
  }

  // separator line
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 90, footerY + 16);
  ctx.lineTo(WIDTH / 2 + 90, footerY + 16);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // club name
  const displayName = clubName
    ? clubName.toUpperCase()
    : "PADEL PROACTIVE";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(displayName, WIDTH / 2, footerY + 38);

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
