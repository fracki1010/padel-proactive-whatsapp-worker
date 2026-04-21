
const client = require("whatsapp-web.js");

async function getNumberByUser(whatsappId) {
  const chatId = String(whatsappId || "").trim();
  if (!chatId) return "";

  const contact = await client.getContactById(chatId);

  return contact
}

module.exports = { getNumberByUser };
