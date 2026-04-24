async function obtenerIdDeNumero(numero, client) {
  try {
    const idObj = await client.getNumberId(numero);
    if (idObj) {
      return idObj._serialized;
    }
    console.log(`[getIdByNumber] Número ${numero} no tiene WhatsApp registrado.`);
    return null;
  } catch (error) {
    console.error("[getIdByNumber] Error buscando ID:", error);
    return null;
  }
}

module.exports = { obtenerIdDeNumero };
