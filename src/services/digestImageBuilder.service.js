const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 600;
const PADDING = 36;
const HEADER_HEIGHT = 100;
const ROW_HEIGHT = 52;
const FOOTER_HEIGHT = 64;
const RADIUS = 24;

const COLOR_BG = "#0f1923";
const COLOR_CARD = "#172030";
const COLOR_ACCENT = "#a3e635";
const COLOR_TEXT_PRIMARY = "#f1f5f9";
const COLOR_TEXT_MUTED = "#64748b";
const COLOR_ROW_ALT = "#1e2d3d";
const COLOR_BADGE_BG = "#1e3a1e";
const COLOR_BADGE_TEXT = "#a3e635";

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

const drawBadge = (ctx, text, x, y) => {
  const badgePad = 10;
  ctx.font = "bold 13px sans-serif";
  const textW = ctx.measureText(text).width;
  const badgeW = textW + badgePad * 2;
  const badgeH = 26;
  roundRect(ctx, x, y - badgeH / 2, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = COLOR_BADGE_BG;
  ctx.fill();
  ctx.fillStyle = COLOR_BADGE_TEXT;
  ctx.fillText(text, x + badgePad, y + 5);
  return badgeW;
};

const buildDigestImage = async (entries = [], dateLabel = "", backgroundUrl = null) => {
  const rowCount = entries.length || 1;
  const canvasHeight =
    PADDING + HEADER_HEIGHT + rowCount * ROW_HEIGHT + FOOTER_HEIGHT + PADDING;

  const canvas = createCanvas(WIDTH, canvasHeight);
  const ctx = canvas.getContext("2d");

  // clip canvas to rounded rect for all drawing
  roundRect(ctx, 0, 0, WIDTH, canvasHeight, RADIUS);
  ctx.clip();

  if (backgroundUrl) {
    try {
      const bgImage = await loadImage(backgroundUrl);
      // cover-fit: scale to fill, center crop
      const scale = Math.max(WIDTH / bgImage.width, canvasHeight / bgImage.height);
      const bw = bgImage.width * scale;
      const bh = bgImage.height * scale;
      const bx = (WIDTH - bw) / 2;
      const by = (canvasHeight - bh) / 2;
      ctx.drawImage(bgImage, bx, by, bw, bh);

      // dark overlay for readability
      ctx.fillStyle = "rgba(10, 18, 28, 0.72)";
      ctx.fillRect(0, 0, WIDTH, canvasHeight);
    } catch {
      // fallback to solid bg if image fails
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, WIDTH, canvasHeight);
    }
  } else {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, WIDTH, canvasHeight);
  }

  // header area
  let y = PADDING;

  // title
  ctx.fillStyle = COLOR_ACCENT;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("🎾  Disponibilidad de hoy", PADDING, y + 34);

  if (dateLabel) {
    ctx.fillStyle = COLOR_TEXT_MUTED;
    ctx.font = "14px sans-serif";
    ctx.fillText(dateLabel, PADDING, y + 58);
  }

  // divider
  y += HEADER_HEIGHT - 8;
  ctx.strokeStyle = COLOR_TEXT_MUTED;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  y += 8;

  if (!entries.length) {
    ctx.fillStyle = COLOR_TEXT_MUTED;
    ctx.font = "16px sans-serif";
    ctx.fillText("Hoy no quedan turnos disponibles.", PADDING, y + ROW_HEIGHT / 2 + 6);
  } else {
    entries.forEach((entry, i) => {
      const rowY = y + i * ROW_HEIGHT;
      const isAlt = i % 2 === 1;

      roundRect(ctx, PADDING - 8, rowY + 4, WIDTH - (PADDING - 8) * 2, ROW_HEIGHT - 8, 12);
      ctx.fillStyle = backgroundUrl
        ? isAlt ? "rgba(30, 45, 61, 0.75)" : "rgba(23, 32, 48, 0.75)"
        : isAlt ? COLOR_ROW_ALT : COLOR_CARD;
      ctx.fill();

      ctx.fillStyle = COLOR_TEXT_PRIMARY;
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${entry.startTime} – ${entry.endTime}`, PADDING + 4, rowY + ROW_HEIGHT / 2 + 6);

      const badgeText = `${entry.availableCourts} cancha${entry.availableCourts !== 1 ? "s" : ""} libre${entry.availableCourts !== 1 ? "s" : ""}`;
      const badgeX = WIDTH - PADDING - 8 - (ctx.measureText(badgeText).width + 20 + 4);
      drawBadge(ctx, badgeText, badgeX, rowY + ROW_HEIGHT / 2 + 4);
    });
  }

  // footer
  const footerY = PADDING + HEADER_HEIGHT + rowCount * ROW_HEIGHT + 4;

  ctx.strokeStyle = COLOR_TEXT_MUTED;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, footerY);
  ctx.lineTo(WIDTH - PADDING, footerY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLOR_TEXT_MUTED;
  ctx.font = "13px sans-serif";
  ctx.fillText("Reservá respondiendo este chat  ·  Padel Proactive", PADDING, footerY + 28);

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
