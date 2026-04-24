const { getReadyClient } = require("../services/whatsappTenantManager.service");
const { obtenerIdDeNumero } = require("./getIdByNumber");

async function getWhatsappIdByPhone(phone, companyId = null) {
  const number = String(phone || "").replace(/\D/g, "");
  if (!number) return null;

  try {
    const client = getReadyClient(companyId);
    const id = await obtenerIdDeNumero(number, client);
    return id || null;
  } catch {
    return null;
  }
}

module.exports = { getWhatsappIdByPhone };
