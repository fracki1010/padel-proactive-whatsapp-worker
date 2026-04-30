const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH    = 600;
const COLOR_BG = "#0a1018";
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

const buildIndicatorParts = (count, isIndoor) => ({
  count: count > 1 ? `x${count}` : "",
  type:  isIndoor === true ? "Indoor" : isIndoor === false ? "Outdoor" : "",
});

const buildDigestImage = async (
  entries = [],
  dateLabel = "",
  backgroundUrl = null,
  clubName = "",
  botPhone = "",
) => {
  // ── Auto-fit title font ──────────────────────────────────────────────────
  const tmpCtx = createCanvas(WIDTH, 80).getContext("2d");
  const MAX_TITLE = 30;
  tmpCtx.font = `bold ${MAX_TITLE}px sans-serif`;
  const longestW = Math.max(
    tmpCtx.measureText("TURNOS").width,
    tmpCtx.measureText("LIBRES").width,
  );
  const TITLE_SIZE   = longestW > WIDTH - 48
    ? Math.floor(MAX_TITLE * (WIDTH - 48) / longestW)
    : MAX_TITLE;
  const TITLE_LINE_H = Math.round(TITLE_SIZE * 1.15);

  // ── Top section ──────────────────────────────────────────────────────────
  const TOP_PAD  = 80;
  const DAY_SIZE = 13;
  const DAY_H    = 28;
  const GAP_1    = 24;

  const dayTagTop      = TOP_PAD;
  const title1Baseline = dayTagTop + DAY_H + GAP_1 + TITLE_SIZE;
  const title2Baseline = title1Baseline + TITLE_LINE_H;

  // ── Background image — determines canvas height ──────────────────────────
  let bgImg = null;
  if (backgroundUrl) {
    try { bgImg = await loadImage(backgroundUrl); } catch { bgImg = null; }
  }
  const HEIGHT = bgImg
    ? Math.round(WIDTH * bgImg.height / bgImg.width)
    : Math.round(WIDTH * 16 / 9);

  // ── Bottom section (anchored to canvas bottom) ───────────────────────────
  const BOTTOM_PAD = 60;
  const PHONE_SIZE = 24;
  const CLUB_SIZE  = 11;

  const footerClubY  = HEIGHT - BOTTOM_PAD;
  const footerPhoneY = footerClubY - 20 - CLUB_SIZE;

  // ── Pills — centered in the space between title and footer ───────────────
  const PILL_H   = 60;
  const PILL_GAP = 14;
  const PILL_W   = 300;
  const PILL_R   = PILL_H / 2;

  const slotCount  = Math.max(entries.length, 1);
  const slotsH     = slotCount * (PILL_H + PILL_GAP) - PILL_GAP;
  const zoneTop    = title2Baseline + 30;
  const zoneBottom = footerPhoneY - 60;
  const pillsTop   = Math.round((zoneTop + zoneBottom - slotsH) / 2);

  // ── Canvas ───────────────────────────────────────────────────────────────
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext("2d");

  // Background
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Cinematic gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0,    "rgba(0,0,0,0.72)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.65, "rgba(0,0,0,0.35)");
  grad.addColorStop(1,    "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";

  // ── Weekday tag ──────────────────────────────────────────────────────────
  const weekday = String(dateLabel || "").split(",")[0].trim().toUpperCase() || "HOY";
  const tagW    = 120;
  const tagX    = (WIDTH - tagW) / 2;
  roundRect(ctx, tagX, dayTagTop, tagW, DAY_H, DAY_H / 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font      = `bold ${DAY_SIZE}px sans-serif`;
  ctx.fillText(weekday, WIDTH / 2, dayTagTop + DAY_H / 2 + DAY_SIZE / 2 - 1);

  // ── Title: "TURNOS / LIBRES" ─────────────────────────────────────────────
  ctx.shadowColor = COLOR_ACCENT;
  ctx.shadowBlur  = 22;
  ctx.fillStyle   = COLOR_ACCENT;
  ctx.font        = `bold ${TITLE_SIZE}px sans-serif`;
  ctx.fillText("TURNOS", WIDTH / 2, title1Baseline);
  ctx.fillText("LIBRES", WIDTH / 2, title2Baseline);
  ctx.shadowBlur  = 0;

  // ── Slot pills ───────────────────────────────────────────────────────────
  const pillLeft = (WIDTH - PILL_W) / 2;

  if (!entries.length) {
    roundRect(ctx, pillLeft, pillsTop, PILL_W, PILL_H, PILL_R);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font      = "bold 17px sans-serif";
    ctx.fillText("Sin turnos disponibles", WIDTH / 2, pillsTop + PILL_H / 2 + 6);
  } else {
    entries.forEach((entry, i) => {
      const pillY = pillsTop + i * (PILL_H + PILL_GAP);
      const midY  = pillY + PILL_H / 2;

      ctx.shadowColor   = "rgba(0,0,0,0.45)";
      ctx.shadowBlur    = 14;
      ctx.shadowOffsetY = 5;
      roundRect(ctx, pillLeft, pillY, PILL_W, PILL_H, PILL_R);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fill();
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetY = 0;

      const { count: countStr, type: typeStr } = buildIndicatorParts(entry.count, entry.isIndoor);
      const TIME_SIZE = 26;
      const TYPE_SIZE = 12;
      const GAP_CT    = 10;
      const GAP_TC    = 14;

      ctx.font = `bold ${TIME_SIZE}px sans-serif`;
      const timeW  = ctx.measureText(entry.startTime).width;
      const countW = countStr ? ctx.measureText(countStr).width : 0;
      ctx.font     = `bold ${TYPE_SIZE}px sans-serif`;
      const typeW  = typeStr  ? ctx.measureText(typeStr).width  : 0;

      const totalW = timeW
        + (countStr ? GAP_TC + countW : 0)
        + (typeStr  ? GAP_CT + typeW  : 0);
      const startX = WIDTH / 2 - totalW / 2;

      ctx.textAlign = "left";

      ctx.fillStyle = "#0d0d0d";
      ctx.font      = `bold ${TIME_SIZE}px sans-serif`;
      ctx.fillText(entry.startTime, startX, midY + 9);

      let cursorX = startX + timeW;

      if (countStr) {
        ctx.fillStyle = "#0d0d0d";
        ctx.font      = `bold ${TIME_SIZE}px sans-serif`;
        ctx.fillText(countStr, cursorX + GAP_TC, midY + 9);
        cursorX += GAP_TC + countW;
      }

      if (typeStr) {
        ctx.fillStyle = "rgba(20,20,20,0.45)";
        ctx.font      = `bold ${TYPE_SIZE}px sans-serif`;
        ctx.fillText(typeStr, cursorX + GAP_CT, midY + 9);
      }
    });
  }

  ctx.textAlign = "center";

  // ── Footer phone ─────────────────────────────────────────────────────────
  if (botPhone) {
    const phoneText  = formatPhone(botPhone);
    ctx.font         = `bold ${PHONE_SIZE}px sans-serif`;
    const phoneW     = ctx.measureText(phoneText).width;
    const phonePadX  = 28;
    const phonePillW = phoneW + phonePadX * 2;
    const phonePillH = PHONE_SIZE + 18;
    const phonePillX = (WIDTH - phonePillW) / 2;
    const phonePillY = footerPhoneY - PHONE_SIZE - 6;

    roundRect(ctx, phonePillX, phonePillY, phonePillW, phonePillH, phonePillH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(phoneText, WIDTH / 2, footerPhoneY);
  }

  // thin separator
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 70, footerPhoneY + 10);
  ctx.lineTo(WIDTH / 2 + 70, footerPhoneY + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // club name
  const displayName = (clubName || "Padel Proactive").toUpperCase();
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font      = `bold ${CLUB_SIZE}px sans-serif`;
  ctx.fillText(displayName, WIDTH / 2, footerClubY);

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
