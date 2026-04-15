const WhatsappRuntimeState = require("../models/whatsappRuntimeState.model");

const createBaseState = () => ({
  enabled: false,
  status: "disabled",
  qr: null,
  hasQr: false,
  loadingPercent: null,
  loadingMessage: null,
  lastQrAt: null,
  authenticatedAt: null,
  readyAt: null,
  authFailure: null,
  lastError: null,
  lastDisconnectReason: null,
  startingAt: null,
  stoppedAt: null,
  reconnectAttempts: 0,
  updatedAt: new Date().toISOString(),
});

const normalizeCompanyId = (companyId = null) => companyId || null;

const saveWhatsappRuntimeState = async (companyId = null, state = {}) => {
  const normalizedCompanyId = normalizeCompanyId(companyId);

  const normalizedState = {
    enabled: Boolean(state.enabled),
    status: String(state.status || "disabled"),
    qr: typeof state.qr === "string" ? state.qr : null,
    hasQr: Boolean(state.hasQr),
    loadingPercent:
      typeof state.loadingPercent === "number" ? state.loadingPercent : null,
    loadingMessage:
      typeof state.loadingMessage === "string" ? state.loadingMessage : null,
    lastQrAt: typeof state.lastQrAt === "string" ? state.lastQrAt : null,
    authenticatedAt:
      typeof state.authenticatedAt === "string" ? state.authenticatedAt : null,
    readyAt: typeof state.readyAt === "string" ? state.readyAt : null,
    authFailure: typeof state.authFailure === "string" ? state.authFailure : null,
    lastError: typeof state.lastError === "string" ? state.lastError : null,
    lastDisconnectReason:
      typeof state.lastDisconnectReason === "string"
        ? state.lastDisconnectReason
        : null,
    startingAt: typeof state.startingAt === "string" ? state.startingAt : null,
    stoppedAt: typeof state.stoppedAt === "string" ? state.stoppedAt : null,
    reconnectAttempts: Number(state.reconnectAttempts || 0),
    updatedAtIso:
      typeof state.updatedAt === "string" && state.updatedAt
        ? state.updatedAt
        : new Date().toISOString(),
  };

  await WhatsappRuntimeState.findOneAndUpdate(
    { companyId: normalizedCompanyId },
    { $set: { companyId: normalizedCompanyId, ...normalizedState } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = {
  createBaseState,
  saveWhatsappRuntimeState,
};
