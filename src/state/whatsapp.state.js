const GLOBAL_COMPANY_KEY = "global";
const { saveWhatsappRuntimeState } = require("../services/whatsappRuntimeState.service");

const states = new Map();

const buildCompanyKey = (companyId = null) =>
  companyId ? String(companyId) : GLOBAL_COMPANY_KEY;

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

const ensureState = (companyId = null) => {
  const key = buildCompanyKey(companyId);
  if (!states.has(key)) states.set(key, createBaseState());
  return states.get(key);
};

const touch = (companyId = null, state) => {
  state.updatedAt = new Date().toISOString();
  Promise.resolve(saveWhatsappRuntimeState(companyId, state)).catch((error) => {
    console.error(
      `[WhatsAppState][${buildCompanyKey(companyId)}] Error persistiendo runtime state:`,
      error?.message || error,
    );
  });
};

const setEnabled = (companyId = null, enabled) => {
  const state = ensureState(companyId);
  state.enabled = Boolean(enabled);
  touch(companyId, state);
};

const setDisabled = (companyId = null, message = "WhatsApp desactivado") => {
  const state = ensureState(companyId);
  state.status = "disabled";
  state.qr = null;
  state.hasQr = false;
  state.loadingPercent = null;
  state.loadingMessage = message;
  state.stoppedAt = new Date().toISOString();
  touch(companyId, state);
};

const setStartAttempt = (companyId = null, message = "Inicializando") => {
  const state = ensureState(companyId);
  state.status = "initializing";
  state.startingAt = new Date().toISOString();
  state.loadingMessage = message;
  state.lastError = null;
  touch(companyId, state);
};

const setQr = (companyId = null, qr) => {
  const state = ensureState(companyId);
  if (!state.enabled) return;
  state.status = "qr_pending";
  state.qr = qr;
  state.hasQr = Boolean(qr);
  state.lastQrAt = new Date().toISOString();
  touch(companyId, state);
};

const setLoading = (companyId = null, percent, message) => {
  const state = ensureState(companyId);
  if (!state.enabled) return;
  state.status = "loading";
  state.loadingPercent = percent;
  state.loadingMessage = message;
  touch(companyId, state);
};

const setAuthenticated = (companyId = null) => {
  const state = ensureState(companyId);
  if (!state.enabled) return;
  state.status = "authenticated";
  state.qr = null;
  state.hasQr = false;
  state.authenticatedAt = new Date().toISOString();
  touch(companyId, state);
};

const setAuthFailure = (companyId = null, message = "auth_failure") => {
  const state = ensureState(companyId);
  state.status = "auth_failure";
  state.authFailure = message;
  state.lastError = message;
  touch(companyId, state);
};

const setReady = (companyId = null) => {
  const state = ensureState(companyId);
  if (!state.enabled) return;
  state.status = "ready";
  state.qr = null;
  state.hasQr = false;
  state.loadingPercent = null;
  state.loadingMessage = null;
  state.readyAt = new Date().toISOString();
  state.lastError = null;
  state.lastDisconnectReason = null;
  state.reconnectAttempts = 0;
  touch(companyId, state);
};

const setLastError = (companyId = null, message = "Error desconocido") => {
  const state = ensureState(companyId);
  state.lastError = message;
  touch(companyId, state);
};

const setDisconnected = (companyId = null, reason = "desconocido") => {
  const state = ensureState(companyId);
  state.status = "disconnected";
  state.qr = null;
  state.hasQr = false;
  state.loadingMessage = "Cliente desconectado";
  state.lastDisconnectReason = String(reason);
  state.stoppedAt = new Date().toISOString();
  touch(companyId, state);
};

const incrementReconnectAttempts = (companyId = null) => {
  const state = ensureState(companyId);
  state.reconnectAttempts = Number(state.reconnectAttempts || 0) + 1;
  touch(companyId, state);
};

const resetReconnectAttempts = (companyId = null) => {
  const state = ensureState(companyId);
  state.reconnectAttempts = 0;
  touch(companyId, state);
};

const getWhatsappState = (companyId = null) => ({ ...ensureState(companyId) });

module.exports = {
  buildCompanyKey,
  getWhatsappState,
  setEnabled,
  setDisabled,
  setStartAttempt,
  setQr,
  setLoading,
  setAuthenticated,
  setAuthFailure,
  setReady,
  setLastError,
  setDisconnected,
  incrementReconnectAttempts,
  resetReconnectAttempts,
};
