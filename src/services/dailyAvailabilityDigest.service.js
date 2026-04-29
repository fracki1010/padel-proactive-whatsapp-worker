const { MessageMedia } = require("whatsapp-web.js");
const AppConfig = require("../models/appConfig.model");
const Booking = require("../models/booking.model");
const Court = require("../models/court.model");
const TimeSlot = require("../models/timeSlot.model");
const { getWhatsappState } = require("../state/whatsapp.state");
const { getReadyClient } = require("./whatsappTenantManager.service");
const { buildDigestImage } = require("./digestImageBuilder.service");

const CONFIG_KEY = "main";
const TIMEZONE = "America/Argentina/Buenos_Aires";
const CHECK_INTERVAL_MS = 60 * 1000;
const DAILY_HOUR_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_SEND_TIME = DAILY_HOUR_REGEX.test(
  String(process.env.DAILY_AVAILABILITY_DIGEST_TIME || "").trim(),
)
  ? String(process.env.DAILY_AVAILABILITY_DIGEST_TIME).trim()
  : "09:00";

let timer = null;
let isRunning = false;

const buildCompanyFilter = (companyId = null) => ({ companyId: companyId || null });

const normalizeChatId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.endsWith("@g.us")) return raw;
  return `${raw}@g.us`;
};

const dateStringToUtcMidnight = (dateStr) => {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const parseTimeToMinutes = (timeStr) => {
  const [hour, minute] = String(timeStr || "")
    .split(":")
    .map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
};

const getIsoDateInTimezone = (value, timeZone = TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const getTodayIsoInTimezone = (timeZone = TIMEZONE) => getIsoDateInTimezone(new Date(), timeZone);

const getCurrentMinutesInTimezone = (timeZone = TIMEZONE) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
};

const buildDigestMessage = (entries = []) => {
  if (!entries.length) {
    return ["🎾 *Disponibilidad de hoy*", "", "Hoy no quedan turnos disponibles."].join("\n");
  }

  const lines = entries.map(
    (entry) =>
      `• ${entry.startTime}-${entry.endTime}: ${entry.availableCourts} cancha(s) libre(s)`,
  );

  return ["🎾 *Disponibilidad de hoy*", "", ...lines, "", "Reservá por este chat."].join(
    "\n",
  );
};

const buildAvailabilityEntries = async (companyId = null) => {
  const scope = buildCompanyFilter(companyId);
  const todayIso = getTodayIsoInTimezone(TIMEZONE);
  const todayUtcDate = dateStringToUtcMidnight(todayIso);
  const nowMinutes = getCurrentMinutesInTimezone(TIMEZONE);

  const [totalActiveCourts, slots, bookings] = await Promise.all([
    Court.countDocuments({ ...scope, isActive: true }),
    TimeSlot.find({ ...scope, isActive: true }).sort({ order: 1 }).lean(),
    Booking.find({
      ...scope,
      date: todayUtcDate,
      status: { $ne: "cancelado" },
    })
      .select("timeSlot")
      .lean(),
  ]);

  if (totalActiveCourts <= 0 || !slots.length) return [];

  const busyBySlotId = bookings.reduce((acc, booking) => {
    const slotId = String(booking?.timeSlot || "");
    if (!slotId) return acc;
    acc[slotId] = (acc[slotId] || 0) + 1;
    return acc;
  }, {});

  return slots
    .filter((slot) => parseTimeToMinutes(slot.startTime) > nowMinutes)
    .map((slot) => {
      const busy = Number(busyBySlotId[String(slot._id)] || 0);
      const availableCourts = Math.max(0, totalActiveCourts - busy);
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableCourts,
      };
    })
    .filter((entry) => entry.availableCourts > 0);
};

const buildDateLabel = (isoDate, timeZone = TIMEZONE) => {
  const date = dateStringToUtcMidnight(isoDate);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
};

const processCompany = async (config) => {
  const companyId = config.companyId || null;
  const tag = `[DailyDigest][${companyId || "global"}]`;
  const todayIso = getTodayIsoInTimezone(TIMEZONE);
  const nowMinutes = getCurrentMinutesInTimezone(TIMEZONE);
  const configuredHour = String(config.dailyAvailabilityDigestHour || "").trim();
  const sendTimeMinutes = parseTimeToMinutes(
    DAILY_HOUR_REGEX.test(configuredHour) ? configuredHour : DEFAULT_SEND_TIME,
  );

  console.log(`${tag} sweep → ahora=${nowMinutes}min sendTime=${sendTimeMinutes}min lastSent="${config.dailyAvailabilityDigestLastSentDate}" hoy="${todayIso}"`);

  if (nowMinutes < sendTimeMinutes) {
    console.log(`${tag} aún no es la hora de envío → skip`);
    return;
  }
  if (String(config.dailyAvailabilityDigestLastSentDate || "") === todayIso) {
    console.log(`${tag} ya enviado hoy → skip`);
    return;
  }

  const groupId = normalizeChatId(config.cancellationGroupId);
  if (!groupId || !groupId.endsWith("@g.us")) {
    console.log(`${tag} groupId inválido: "${groupId}" → skip`);
    return;
  }

  const waState = getWhatsappState(companyId);
  console.log(`${tag} waState.enabled=${waState.enabled}`);
  if (!waState.enabled) return;

  let client;
  try {
    client = getReadyClient(companyId);
  } catch (err) {
    console.error(`${tag} getReadyClient falló:`, err?.message || err);
    return;
  }

  const entries = await buildAvailabilityEntries(companyId);
  const useImage = String(config.dailyAvailabilityDigestFormat || "text") === "image";
  console.log(`${tag} entries=${entries.length} formato=${useImage ? "image" : "text"}`);

  if (useImage) {
    const dateLabel = buildDateLabel(todayIso);
    const imageBuffer = await buildDigestImage(entries, dateLabel);
    const base64 = imageBuffer.toString("base64");
    const media = new MessageMedia("image/png", base64, "disponibilidad.png");
    await client.sendMessage(groupId, media);
  } else {
    const message = buildDigestMessage(entries);
    await client.sendMessage(groupId, message);
  }

  console.log(`${tag} mensaje enviado OK → marcando lastSentDate=${todayIso}`);
  await AppConfig.updateOne(
    { companyId: companyId || null, key: CONFIG_KEY },
    { $set: { dailyAvailabilityDigestLastSentDate: todayIso } },
  );
};

const runSweep = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const configs = await AppConfig.find({
      key: CONFIG_KEY,
      whatsappEnabled: true,
      dailyAvailabilityDigestEnabled: true,
    }).select(
      "companyId cancellationGroupId dailyAvailabilityDigestLastSentDate dailyAvailabilityDigestHour dailyAvailabilityDigestFormat",
    );

    console.log(`[DailyDigest] sweep → ${configs.length} empresa(s) con digest habilitado`);

    for (const config of configs) {
      try {
        await processCompany(config);
      } catch (error) {
        console.error(
          `[DailyDigest][${config.companyId || "global"}] Error en processCompany:`,
          error?.message || error,
        );
      }
    }
  } finally {
    isRunning = false;
  }
};

const startDailyAvailabilityDigestMonitor = () => {
  if (timer) return;
  timer = setInterval(runSweep, CHECK_INTERVAL_MS);
  runSweep().catch(() => {});
};

module.exports = {
  startDailyAvailabilityDigestMonitor,
};
