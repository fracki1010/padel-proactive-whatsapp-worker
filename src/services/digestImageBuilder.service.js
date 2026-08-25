const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

// Registrar fuentes Liberation Sans
GlobalFonts.registerFromPath("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Liberation Sans");
GlobalFonts.registerFromPath("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "Liberation Sans Bold");

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
  // ─ Auto-fit title font (una sola línea) ────────────────────────────────
  const tmpCtx = createCanvas(WIDTH, 100).getContext("2d");
  const MAX_TITLE = 28;
  tmpCtx.font = `28px "Liberation Sans Bold"`;
  const titleW = tmpCtx.measureText("TURNOS LIBRES").width;
  const TITLE_SIZE = titleW > WIDTH - 48
    ? Math.floor(MAX_TITLE * (WIDTH - 48) / titleW)
    : MAX_TITLE;

  // ── Top section ──────────────────────────────────────────────────────────
  const TOP_PAD  = 40;
  const DAY_SIZE = 16;
  const DAY_H    = 36;
  const GAP_1    = 16;

  const dayTagTop      = TOP_PAD;
  const titleBaseline  = dayTagTop + DAY_H + GAP_1 + TITLE_SIZE;

  // ── Background image — determines canvas height ──────────────────────────
  let bgImg = null;
  if (backgroundUrl) {
    try { bgImg = await loadImage(backgroundUrl); } catch { bgImg = null; }
  }
  const HEIGHT = bgImg
    ? Math.round(WIDTH * bgImg.height / bgImg.width)
    : Math.round(WIDTH * 16 / 9);

  // ─ Bottom section (anchored to canvas bottom) ──────────────────────────
  const BOTTOM_PAD = 70;
  const PHONE_SIZE = 28;
  const CLUB_SIZE  = 14;

  const footerClubY  = HEIGHT - BOTTOM_PAD;
  const footerPhoneY = footerClubY - 20 - CLUB_SIZE;

  // ─ Pills — centered in the space between title and footer ───────────────
  const USE_TWO_COLUMNS = entries.length > 5;
  const PILL_H   = USE_TWO_COLUMNS ? 60 : 80;
  const PILL_GAP = USE_TWO_COLUMNS ? 12 : 16;
  const PILL_W   = USE_TWO_COLUMNS ? 260 : 400;
  const PILL_R   = PILL_H / 2;

  const slotCount  = Math.max(entries.length, 1);
  const slotsH     = USE_TWO_COLUMNS
    ? Math.ceil(slotCount / 2) * (PILL_H + PILL_GAP) - PILL_GAP
    : slotCount * (PILL_H + PILL_GAP) - PILL_GAP;
  const zoneTop    = titleBaseline + 60;  // Espacio entre título y pills
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
  const tagW    = 160;
  const tagX    = (WIDTH - tagW) / 2;
  roundRect(ctx, tagX, dayTagTop, tagW, DAY_H, DAY_H / 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font      = `16px "Liberation Sans"`;
  ctx.letterSpacing = "3px";
  ctx.fillText(weekday, WIDTH / 2, dayTagTop + DAY_H / 2 + DAY_SIZE / 2 - 1);
  ctx.letterSpacing = "0px";

  // ── Title: "TURNOS LIBRES" (una línea) ───────────────────────────────────
  // Glow mejorado: doble shadow (tight + wide) para efecto cinematográfico
  ctx.shadowColor = COLOR_ACCENT;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = COLOR_ACCENT;
  ctx.font        = `${TITLE_SIZE}px "Liberation Sans Bold"`;
  ctx.fillText("TURNOS LIBRES", WIDTH / 2, titleBaseline);

  ctx.shadowBlur  = 30;
  ctx.globalAlpha = 0.4;
  ctx.fillText("TURNOS LIBRES", WIDTH / 2, titleBaseline);
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // ── Slot pills ──────────────────────────────────────────────────────────
  const pillLeft = (WIDTH - PILL_W) / 2;

  if (!entries.length) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font      = `22px "Liberation Sans"`;
    ctx.fillText("Sin turnos disponibles", WIDTH / 2, pillsTop + PILL_H / 2 + 8);
  } else {
    entries.forEach((entry, i) => {
      // Calcular posición según layout (1 o 2 columnas)
      let pillX, pillY;
      if (USE_TWO_COLUMNS) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const colWidth = (WIDTH - PILL_GAP) / 2;
        pillX = col * (colWidth + PILL_GAP) + (colWidth - PILL_W) / 2;
        pillY = pillsTop + row * (PILL_H + PILL_GAP);
      } else {
        pillX = (WIDTH - PILL_W) / 2;
        pillY = pillsTop + i * (PILL_H + PILL_GAP);
      }
      const midY  = pillY + PILL_H / 2;

      // Sin borde en la pill completa, solo texto

      const { count: countStr, type: typeStr } = buildIndicatorParts(entry.count, entry.isIndoor);
      const TIME_SIZE = USE_TWO_COLUMNS ? 36 : 52;
      const COUNT_SIZE = USE_TWO_COLUMNS ? 24 : 36;
      const TYPE_SIZE = USE_TWO_COLUMNS ? 11 : 14;
      const GAP_CT    = 10;
      const GAP_TC    = 14;

      ctx.font = `${TIME_SIZE}px "Liberation Sans Bold"`;
      const timeW  = ctx.measureText(entry.startTime).width;
      ctx.font = `${COUNT_SIZE}px "Liberation Sans Bold"`;
      const countW = countStr ? ctx.measureText(countStr).width : 0;

      // Calcular ancho del tipo con padding para el recuadro con relleno
      const TYPE_PAD_X = 10;
      const TYPE_PAD_Y = 6;
      const TYPE_R = 10;
      ctx.font = `${TYPE_SIZE}px "Liberation Sans Bold"`;
      const typeW  = typeStr  ? ctx.measureText(typeStr.toUpperCase()).width  : 0;
      const typeBoxW = typeW + TYPE_PAD_X * 2;
      const typeBoxH = TYPE_SIZE + TYPE_PAD_Y * 2;

      const totalW = timeW
        + (countStr ? GAP_TC + countW : 0)
        + (typeStr  ? GAP_CT + typeBoxW : 0);
      const startX = pillX + (PILL_W - totalW) / 2;

      ctx.textAlign = "left";

      // Hora en blanco
      ctx.fillStyle = "#ffffff";
      ctx.font      = `${TIME_SIZE}px "Liberation Sans Bold"`;
      ctx.fillText(entry.startTime, startX, midY + (USE_TWO_COLUMNS ? 8 : 12));

      let cursorX = startX + timeW;

      if (countStr) {
        // Count en color accent (lima)
        ctx.fillStyle = COLOR_ACCENT;
        ctx.font      = `${COUNT_SIZE}px "Liberation Sans Bold"`;
        ctx.fillText(countStr, cursorX + GAP_TC, midY + (USE_TWO_COLUMNS ? 6 : 10));
        cursorX += GAP_TC + countW;
      }

      if (typeStr) {
        const typeText = typeStr.toUpperCase();
        const typeBoxX = cursorX + GAP_CT;
        const typeBoxY = midY - typeBoxH / 2;

        // Colores según tipo de cancha
        const isIndoor = entry.isIndoor === true;
        const bgColor = isIndoor ? "rgba(212, 175, 55, 0.25)" : "rgba(30, 58, 95, 0.4)";
        const textColor = isIndoor ? "rgba(212, 175, 55, 0.9)" : "rgba(147, 197, 253, 0.9)";

        // Recuadro con relleno
        roundRect(ctx, typeBoxX, typeBoxY, typeBoxW, typeBoxH, TYPE_R);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.strokeStyle = isIndoor ? "rgba(212, 175, 55, 0.5)" : "rgba(147, 197, 253, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Texto del tipo centrado en el recuadro
        ctx.fillStyle = textColor;
        ctx.font      = `${TYPE_SIZE}px "Liberation Sans Bold"`;
        ctx.letterSpacing = "1.5px";
        ctx.fillText(typeText, typeBoxX + TYPE_PAD_X, midY + (USE_TWO_COLUMNS ? 4 : TYPE_SIZE / 2 + 2));
        ctx.letterSpacing = "0px";
      }
    });
  }

  ctx.textAlign = "center";

  // ─ Footer phone ─────────────────────────────────────────────────────────
  if (botPhone) {
    const phoneText  = formatPhone(botPhone);
    ctx.font         = `${PHONE_SIZE}px "Liberation Sans Bold"`;
    const phoneW     = ctx.measureText(phoneText).width;
    const phonePadX  = 32;
    const phonePillW = phoneW + phonePadX * 2;
    const phonePillH = PHONE_SIZE + 20;
    const phonePillX = (WIDTH - phonePillW) / 2;
    const phonePillY = footerPhoneY - PHONE_SIZE - 6;

    roundRect(ctx, phonePillX, phonePillY, phonePillW, phonePillH, phonePillH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.letterSpacing = "1.5px";
    ctx.fillText(phoneText, WIDTH / 2, footerPhoneY);
    ctx.letterSpacing = "0px";
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
  ctx.font      = `14px "Liberation Sans"`;
  ctx.letterSpacing = "4px";
  ctx.fillText(displayName, WIDTH / 2, footerClubY);
  ctx.letterSpacing = "0px";

  return canvas.toBuffer("image/png");
};

module.exports = { buildDigestImage };
