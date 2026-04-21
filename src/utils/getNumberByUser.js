const { getReadyClient } = require("../services/whatsappTenantManager.service");

async function getNumberByUser(whatsappId, companyId = null) {
  const chatId = String(whatsappId || "").trim();
  if (!chatId) return "";

  try {
    const client = getReadyClient(companyId);
    const contact = await client.getContactById(chatId);
    if (contact?.number) return contact.number;
  } catch {
    // cliente no listo, retorna dígitos del chatId como fallback
  }

  return chatId.includes("@") ? chatId.split("@")[0].replace(/\D/g, "") : chatId.replace(/\D/g, "");
}

module.exports = { getNumberByUser };
