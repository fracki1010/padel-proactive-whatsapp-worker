const { getReadyClient: defaultGetReadyClient } = require("../services/whatsappTenantManager.service");

const LID_SUFFIX = "@lid";

const digitsOnly = (value = "") => String(value || "").replace(/\D/g, "");

// WhatsApp serializes identifiers as "<local>@<domain>" (e.g. "5492622345473@c.us").
// For a resolved phone number (PN) keep only the local digits.
const extractPhoneDigits = (serialized = "") => {
  const raw = String(serialized || "").trim();
  if (!raw) return "";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  return digitsOnly(local);
};

const isLidIdentifier = (chatId = "") =>
  String(chatId || "").trim().toLowerCase().endsWith(LID_SUFFIX);

// Resolves a WhatsApp chat id to the client's real phone number.
// A Linked-Device ID (@lid) is NOT a phone number: it must be resolved to the
// real phone number (PN) through WhatsApp, and never returned as digits.
async function getNumberByUser(whatsappId, companyId = null, deps = {}) {
  const chatId = String(whatsappId || "").trim();
  if (!chatId) return "";

  const getReadyClient = deps.getReadyClient || defaultGetReadyClient;
  const isLid = isLidIdentifier(chatId);
  const lidDigits = digitsOnly(chatId.split("@")[0]);
  let client = null;

  // Fast path: the contact already exposes its number.
  try {
    client = getReadyClient(companyId);
    const contact = await client.getContactById(chatId);
    const contactNumber = digitsOnly(contact?.number || "");
    // Never accept the LID itself as a phone number.
    if (contactNumber && !(isLid && contactNumber === lidDigits)) {
      return contactNumber;
    }
  } catch {
    // Client not ready / contact not found; fall through to resolution.
  }

  if (isLid) {
    // Resolve the LID to the real phone number (PN). If it cannot be resolved,
    // return empty instead of leaking the LID digits as if they were a phone.
    try {
      if (client) {
        const results = await client.getContactLidAndPhone(chatId);
        const entry = Array.isArray(results) ? results[0] : results;
        const resolved = extractPhoneDigits(entry?.pn);
        if (resolved) return resolved;
      }
    } catch {
      // Resolution failed: treat the identity as unresolved.
    }
    return "";
  }

  // @c.us / plain number: keep the previous best-effort fallback.
  return digitsOnly(chatId);
}

module.exports = { getNumberByUser };
