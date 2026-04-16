const AppConfig = require("../models/appConfig.model");
const { startClient, stopClient, hasReadyClient } = require("./whatsappTenantManager.service");
const {
  setEnabled,
  setDisabled,
  setStartAttempt,
  setLastError,
  resetReconnectAttempts,
} = require("../state/whatsapp.state");

const CONFIG_KEY = "main";

const buildConfigFilter = (companyId = null) => ({
  companyId: companyId || null,
  key: CONFIG_KEY,
});

const ensureConfig = async (companyId = null) => {
  const existing = await AppConfig.findOne(buildConfigFilter(companyId));
  if (existing) return existing;

  return AppConfig.create({
    companyId: companyId || null,
    key: CONFIG_KEY,
    whatsappEnabled: false,
  });
};

const setWhatsappEnabledConfigOnly = async (enabled, companyId = null) =>
  AppConfig.findOneAndUpdate(
    buildConfigFilter(companyId),
    { $set: { whatsappEnabled: Boolean(enabled) } },
    { upsert: true, returnDocument: "after" },
  );

const startWhatsapp = async (companyId = null) => {
  setEnabled(companyId, true);
  if (!hasReadyClient(companyId)) {
    setStartAttempt(companyId, "Inicializando cliente de WhatsApp...");
  }

  try {
    await startClient(companyId);
    resetReconnectAttempts(companyId);
  } catch (error) {
    if (hasReadyClient(companyId)) {
      console.warn(
        `[WA][${companyId || "global"}] start error ignored: existing ready client`,
        error?.message || error,
      );
      return;
    }
    const message = String(error?.message || "");
    setLastError(companyId, message || "No se pudo iniciar WhatsApp");
    setDisabled(companyId, "No se pudo iniciar WhatsApp");
    setEnabled(companyId, false);
    throw error;
  }
};

const stopWhatsapp = async (companyId = null) => {
  setEnabled(companyId, false);
  setDisabled(companyId, "WhatsApp desactivado manualmente");
  await stopClient(companyId);
};

const setWhatsappEnabled = async (enabled, companyId = null) => {
  const nextEnabled = Boolean(enabled);
  await setWhatsappEnabledConfigOnly(nextEnabled, companyId);

  if (nextEnabled) {
    await startWhatsapp(companyId);
  } else {
    await stopWhatsapp(companyId);
  }
};

const syncAllWhatsappFromConfig = async () => {
  const configs = await AppConfig.find({ key: CONFIG_KEY });

  if (!configs.length) {
    const config = await ensureConfig(null);
    if (config.whatsappEnabled) await startWhatsapp(null);
    return;
  }

  for (const config of configs) {
    const companyId = config.companyId || null;
    try {
      if (config.whatsappEnabled) {
        await startWhatsapp(companyId);
      } else {
        await stopWhatsapp(companyId);
      }
    } catch (error) {
      console.error(
        `[WhatsApp][${companyId || "global"}] Error sincronizando:`,
        error?.message || error,
      );
    }
  }
};

module.exports = {
  setWhatsappEnabled,
  syncAllWhatsappFromConfig,
};
