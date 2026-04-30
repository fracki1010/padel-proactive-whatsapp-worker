const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 600;
const COLOR_BG     = "#0a1018";
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

// Returns { count: "x3", type: "Outdoor" } — rendered with different sizes
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
  const TITLE_SIZE  = longestW > WIDTH - 48
    ? Math.floor(MAX_TITLE * (WIDTH - 48) / longestW)
    : MAX_TITLE;
  const TITLE_LINE_H = Math.round(TITLE_SIZE * 1.15);

  // ── Layout ──────────────────────────────────────────────────────────────
  const TOP_PAD  = 48;
  const DAY_SIZE = 13;       // compact weekday tag
  const DAY_H    = 28;       // tag height
  const GAP_1    = 20;       // day → title

  const dayTagTop      = TOP_PAD;
  const title1Baseline = dayTagTop + DAY_H + GAP_1 + TITLE_SIZE;
  const title2Baseline = title1Baseline + TITLE_LINE_H;

  const GAP_2    = 44;
  const PILL_H   = 60;
  const PILL_GAP = 14;
  const PILL_W   = 300;
  const PILL_R   = PILL_H / 2;

  const pillsTop  = title2Baseline + GAP_2;
  const slotCount = Math.max(entries.length, 1);
  const slotsH    = slotCount * (PILL_H + PILL_GAP) - PILL_GAP;

  const GAP_3       = 44;
  const PHONE_SIZE  = 24;
  const CLUB_SIZE   = 11;
  const BOTTOM_PAD  = 42;

  const footerPhoneY = pillsTop + slotsH + GAP_3 + PHONE_SIZE;
  const footerClubY  = footerPhoneY + 18 + CLUB_SIZE;
  const canvasHeight = footerClubY + BOTTOM_PAD;

  // ── Canvas ───────────────────────────────────────────────────────────────
  const canvas = createCanvas(WIDTH, canvasHeight);
  const ctx    = canvas.getContext("2d");

  // Background
  if (backgroundUrl) {
    try {
      const bgImg  = await loadImage(backgroundUrl);
      const scale  = Math.max(WIDTH / bgImg.width, canvasHeight / bgImg.height);
      const bw = bgImg.width * scale;
      const bh = bgImg.height * scale;
      ctx.drawImage(bgImg, (WIDTH - bw) / 2, (canvasHeight - bh) / 2, bw, bh);
    } catch {
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, WIDTH, canvasHeight);
    }
  } else {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, WIDTH, canvasHeight);
  }

  // Cinematic gradient overlay — darker top & bottom, lighter center
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0,    "rgba(0,0,0,0.72)");
  grad.addColorStop(0.38, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.62, "rgba(0,0,0,0.35)");
  grad.addColorStop(1,    "rgba(0,0,0,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, canvasHeight);

  ctx.textAlign = "center";

  // ── Weekday tag ──────────────────────────────────────────────────────────
  const weekday  = String(dateLabel || "").split(",")[0].trim().toUpperCase() || "HOY";
  const tagW     = 120;
  const tagX     = (WIDTH - tagW) / 2;
  roundRect(ctx, tagX, dayTagTop, tagW, DAY_H, DAY_H / 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `bold ${DAY_SIZE}px sans-serif`;
  ctx.fillText(weekday, WIDTH / 2, dayTagTop + DAY_H / 2 + DAY_SIZE / 2 - 1);

  // ── Title: "TURNOS LIBRES" with subtle glow ──────────────────────────────
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

      // pill drop shadow
      ctx.shadowColor  = "rgba(0,0,0,0.45)";
      ctx.shadowBlur   = 14;
      ctx.shadowOffsetY = 5;
      roundRect(ctx, pillLeft, pillY, PILL_W, PILL_H, PILL_R);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fill();
      ctx.shadowBlur   = 0;
      ctx.shadowOffsetY = 0;

      const { count: countStr, type: typeStr } = buildIndicatorParts(entry.count, entry.isIndoor);
      const TIME_SIZE = 26;
      const TYPE_SIZE = 12;
      const GAP_CT    = 10; // gap between count and type
      const GAP_TC    = 14; // gap between time and count

      // measure all parts at their respective fonts to center as one block
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

      // time — big dark
      ctx.fillStyle = "#0d0d0d";
      ctx.font      = `bold ${TIME_SIZE}px sans-serif`;
      ctx.fillText(entry.startTime, startX, midY + 9);

      let cursorX = startX + timeW;

      // count (x3) — same size & color as time
      if (countStr) {
        ctx.fillStyle = "#0d0d0d";
        ctx.font      = `bold ${TIME_SIZE}px sans-serif`;
        ctx.fillText(countStr, cursorX + GAP_TC, midY + 9);
        cursorX += GAP_TC + countW;
      }

      // type (Outdoor/Indoor) — smaller, softer
      if (typeStr) {
        ctx.fillStyle = "rgba(20,20,20,0.45)";
        ctx.font      = `bold ${TYPE_SIZE}px sans-serif`;
        // align baseline optically to the bigger text
        ctx.fillText(typeStr, cursorX + GAP_CT, midY + 9);
      }
    });
  }

  ctx.textAlign = "center";

  // ── Footer phone — inside a frosted pill ─────────────────────────────────
  if (botPhone) {
    const phoneText = formatPhone(botPhone);
    ctx.font = `bold ${PHONE_SIZE}px sans-serif`;
    const phoneW  = ctx.measureText(phoneText).width;
    const phonePadX = 28;
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
  ctx.globalAlpha   = 0.2;
  ctx.strokeStyle   = "#ffffff";
  ctx.lineWidth     = 1;
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
