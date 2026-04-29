const AppConfig = require("../models/appConfig.model");
const { getReadyClient } = require("./whatsappTenantManager.service");

const normalizeChatId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.endsWith("@g.us")) return raw;
  return `${raw}@g.us`;
};

const getWhatsappCancellationGroupSettings = async (companyId = null) => {
  const config = await AppConfig.findOne({ companyId: companyId || null, key: "main" }).lean();

  return {
    enabled: Boolean(config?.cancellationGroupEnabled),
    groupId: String(config?.cancellationGroupId || "").trim(),
    groupName: String(config?.cancellationGroupName || "").trim(),
  };
};

const notifyCancellationToGroup = async ({ companyId = null, booking, time, courtName }) => {
  const tag = `[CancellationGroup][${companyId || "global"}]`;
  console.log(`${tag} notifyCancellationToGroup llamado`);

  const settings = await getWhatsappCancellationGroupSettings(companyId);
  console.log(`${tag} settings:`, JSON.stringify(settings));

  if (!settings.enabled) {
    console.log(`${tag} grupo desactivado (cancellationGroupEnabled=false) → no se envía`);
    return { sent: false, reason: "group_alerts_disabled" };
  }

  const groupId = normalizeChatId(settings.groupId);
  if (!groupId.endsWith("@g.us")) {
    console.log(`${tag} groupId inválido: "${groupId}" → no se envía`);
    return { sent: false, reason: "missing_or_invalid_group_id" };
  }

  console.log(`${tag} enviando a groupId=${groupId}`);
  let client;
  try {
    client = getReadyClient(companyId);
  } catch (err) {
    console.error(`${tag} getReadyClient falló:`, err?.message || err);
    throw err;
  }

  const message = [
    "🎾 *Turno liberado*",
    "",
    `⏰ *Hora:* ${time || booking?.timeSlot?.startTime || "N/D"}`,
    `🏟️ *Cancha:* ${courtName || booking?.court?.name || "N/D"}`,
    "",
    "Si te interesa, pedilo por este chat.",
  ].join("\n");

  await client.sendMessage(groupId, message);
  console.log(`${tag} mensaje enviado OK`);
  return { sent: true, groupId };
};

const listWhatsappGroups = async (companyId = null) => {
  const client = getReadyClient(companyId);
  const chats = await client.getChats();

  return chats
    .filter((chat) => Boolean(chat?.isGroup))
    .map((chat) => ({
      id: normalizeChatId(chat?.id?._serialized || chat?.id || ""),
      name: String(chat?.name || chat?.formattedTitle || "").trim(),
    }))
    .filter((group) => group.id.endsWith("@g.us"))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
};

module.exports = {
  listWhatsappGroups,
  notifyCancellationToGroup,
};
