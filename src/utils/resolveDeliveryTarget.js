"use strict";

// Chat IDs que YA están completos y NO deben convertirse a número.
// - @lid: Linked Device ID (dispositivo vinculado). No es un número de teléfono,
//   así que resolverlo con getNumberId es imposible y rompía las respuestas.
// - @g.us: grupo. Se envía directo al chat ID del grupo.
const DIRECT_CHAT_ID_SUFFIXES = ["@lid", "@g.us"];

const isDirectChatId = (chatId) => {
  const value = String(chatId || "");
  return DIRECT_CHAT_ID_SUFFIXES.some((suffix) => value.endsWith(suffix));
};

/**
 * Determina el destinatario final de un comando SEND_MESSAGE.
 *
 * - @lid / @g.us        → se envía directo (chat IDs no convertibles o ya completos).
 * - @c.us / número pelado → se resuelve con getNumberId, extrayendo el número
 *   real con getNumberByUser cuando el destino viene como chat ID (@c.us).
 *
 * La clasificación es pura y las dependencias se inyectan, de modo que la lógica
 * se puede testear sin un cliente real de WhatsApp.
 *
 * @param {string} rawTo Destino tal como llega en el payload (`to`).
 * @param {object} client Cliente de WhatsApp (solo pasado a `resolveId`).
 * @param {string|null} companyId Tenant para resolver el número.
 * @param {{resolveNumber?: Function, resolveId?: Function}} [deps]
 *   `resolveNumber(chatId, companyId)` → número real.
 *   `resolveId(phoneNumber, client)` → chat ID final (o null si no está registrado).
 * @returns {Promise<string>} Chat ID final listo para `client.sendMessage`.
 */
const resolveDeliveryTarget = async (rawTo, client, companyId, deps) => {
  const resolveNumber =
    deps?.resolveNumber || require("./getNumberByUser").getNumberByUser;
  const resolveId =
    deps?.resolveId || require("./getIdByNumber").obtenerIdDeNumero;

  const target = String(rawTo || "").trim();
  if (!target) {
    throw new Error("Chat ID vacío para SEND_MESSAGE.");
  }

  if (isDirectChatId(target)) {
    return target;
  }

  const phoneNumber = target.includes("@")
    ? await resolveNumber(target, companyId)
    : target;

  const resolvedTo = await resolveId(phoneNumber, client);
  if (!resolvedTo) {
    throw new Error(`Número ${phoneNumber} no está registrado en WhatsApp.`);
  }

  return resolvedTo;
};

module.exports = {
  resolveDeliveryTarget,
  isDirectChatId,
  DIRECT_CHAT_ID_SUFFIXES,
};
