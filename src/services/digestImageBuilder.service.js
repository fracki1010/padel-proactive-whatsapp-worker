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

const buildIndicator = (count, isIndoor) => {
  const type = isIndoor === true ? "Indoor" : isIndoor === false ? "Outdoor" : "";
  const countPart = count > 1 ? `x${count}` : "";
  return [countPart, type].filter(Boolean).join("  ");
};

const buildDigestImage = async (entries = [], dateLabel = "", backgroundUrl = null, clubName = "", botPhone = "") => {
  // ── Measure title font size to auto-fit width ──────────────────────────────
  const tmpCanvas = createCanvas(WIDTH, 100);
  const tmpCtx = tmpCanvas.getContext("2d");
  const MAX_TITLE_SIZE = 48;
  const TITLE_PADDING = 24; // px each side
  tmpCtx.font = `bold ${MAX_TITLE_SIZE}px sans-serif`;
  const maxTextW = Math.max(
    tmpCtx.measureText("TURNOS").width,
    tmpCtx.measureText("LIBRES").width,
  );
  const TITLE_SIZE = maxTextW > WIDTH - TITLE_PADDING * 2
    ? Math.floor(MAX_TITLE_SIZE * (WIDTH - TITLE_PADDING * 2) / maxTextW)
    : MAX_TITLE_SIZE;
  const TITLE_LINE_H = Math.round(TITLE_SIZE * 1.12);

  // ── Layout constants (all in px, top-to-bottom) ───────────────────────────
  const TOP_PAD      = 52;
  const WEEKDAY_SIZE = 22;
  const GAP_1        = 18;  // weekday → title line 1

  const weekdayBaseline = TOP_PAD + WEEKDAY_SIZE;
  const title1Baseline  = weekdayBaseline + GAP_1 + TITLE_SIZE;
  const title2Baseline  = title1Baseline + TITLE_LINE_H;

  const GAP_2    = 46;  // title line 2 → first pill
  const PILL_H   = 64;
  const PILL_GAP = 16;
  const PILL_W   = 280;
  const PILL_R   = PILL_H / 2;

  const pillsTop  = title2Baseline + GAP_2;
  const slotCount = Math.max(entries.length, 1);
  const slotsH    = slotCount * (PILL_H + PILL_GAP) - PILL_GAP;

  const GAP_3        = 40;  // last pill → footer phone
  const PHONE_SIZE   = 26;
  const SEP_GAP      = 14;
  const CLUB_SIZE    = 13;
  const BOTTOM_PAD   = 44;

  const footerPhoneY = pillsTop + slotsH + GAP_3 + PHONE_SIZE;
  const footerClubY  = footerPhoneY + SEP_GAP + CLUB_SIZE;
  const canvasHeight = footerClubY + BOTTOM_PAD;

  // ── Canvas & background ────────────────────────────────────────────────────
  const canvas = createCanvas(WIDTH, canvasHeight);
  const ctx = canvas.getContext("2d");

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

  // ── Weekday ────────────────────────────────────────────────────────────────
  const weekday = String(dateLabel || "").split(",")[0].trim().toUpperCase() || "HOY";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${WEEKDAY_SIZE}px sans-serif`;
  ctx.fillText(weekday, WIDTH / 2, weekdayBaseline);

  // ── "TURNOS LIBRES" (auto-sized) ───────────────────────────────────────────
  ctx.fillStyle = COLOR_ACCENT;
  ctx.font = `bold ${TITLE_SIZE}px sans-serif`;
  ctx.fillText("TURNOS", WIDTH / 2, title1Baseline);
  ctx.fillText("LIBRES", WIDTH / 2, title2Baseline);

  // ── Slot pills ─────────────────────────────────────────────────────────────
  const pillLeft  = (WIDTH - PILL_W) / 2;

  if (!entries.length) {
    roundRect(ctx, pillLeft, pillsTop, PILL_W, PILL_H, PILL_R);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 19px sans-serif";
    ctx.fillText("Sin turnos disponibles", WIDTH / 2, pillsTop + PILL_H / 2 + 7);
  } else {
    entries.forEach((entry, i) => {
      const pillY  = pillsTop + i * (PILL_H + PILL_GAP);
      const textY  = pillY + PILL_H / 2 + 11;

      roundRect(ctx, pillLeft, pillY, PILL_W, PILL_H, PILL_R);
      ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
      ctx.fill();

      const indicator = buildIndicator(entry.count, entry.isIndoor);
      const SLOT_FONT = "bold 22px sans-serif";

      // measure both parts at the same font size to center as a block
      ctx.font = SLOT_FONT;
      const timeW  = ctx.measureText(entry.startTime).width;
      const indW   = indicator ? ctx.measureText(indicator).width : 0;
      const gap    = indicator ? 14 : 0;
      const totalW = timeW + gap + indW;
      const startX = WIDTH / 2 - totalW / 2;

      ctx.fillStyle = "#111111";
      ctx.textAlign = "left";
      ctx.fillText(entry.startTime, startX, textY);

      if (indicator) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fillText(indicator, startX + timeW + gap, textY);
      }
    });
  }

  ctx.textAlign = "center";

  // ── Footer ─────────────────────────────────────────────────────────────────
  if (botPhone) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${PHONE_SIZE}px sans-serif`;
    ctx.fillText(formatPhone(botPhone), WIDTH / 2, footerPhoneY);
  }

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 80, footerPhoneY + 8);
  ctx.lineTo(WIDTH / 2 + 80, footerPhoneY + 8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const displayName = clubName ? clubName.toUpperCase() : "PADEL PROACTIVE";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = `bold ${CLUB_SIZE}px sans-serif`;
  ctx.fillText(displayName, WIDTH / 2, footerClubY);

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
