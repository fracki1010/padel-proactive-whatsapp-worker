const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const {
  buildCompanyKey,
  getWhatsappState,
  setQr,
  setLoading,
  setAuthenticated,
  setAuthFailure,
  setReady,
  setDisconnected,
  setStartAttempt,
  setLastError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
} = require("../state/whatsapp.state");

const clients = new Map();

const WA_REMOTE_HTML =
  process.env.WA_REMOTE_HTML ||
  "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html";
const WA_AUTH_DATA_PATH = process.env.WA_AUTH_DATA_PATH || "/usr/src/app/.wwebjs_auth";

const buildClientId = (companyId = null) => `tenant-${buildCompanyKey(companyId)}`;

const createClient = (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: buildClientId(companyId),
      dataPath: WA_AUTH_DATA_PATH,
    }),
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROMIUM_PATH ||
      "/usr/bin/chromium",
    webVersionCache: { type: "remote", remotePath: WA_REMOTE_HTML },
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
    },
  });

  client.isReady = false;

  client.on("qr", (qr) => {
    console.log(`✨ [${key}] Nuevo QR.`);
    qrcode.generate(qr, { small: true });
    setQr(companyId, qr);
  });

  client.on("loading_screen", (percent, message) => {
    setLoading(companyId, percent, message);
  });

  client.on("authenticated", () => setAuthenticated(companyId));

  client.on("auth_failure", (msg) => {
    console.error(`❌ [${key}] auth_failure:`, msg);
    setAuthFailure(companyId, msg);
  });

  client.on("ready", () => {
    client.isReady = true;
    resetReconnectAttempts(companyId);
    setReady(companyId);
    console.log(`🌟 [${key}] WhatsApp listo.`);
  });

  client.on("disconnected", (reason) => {
    client.isReady = false;
    setDisconnected(companyId, reason);
    console.warn(`⚠️ [${key}] desconectado: ${reason || "desconocido"}`);
  });

  client.on("message", async (message) => {
    // Worker desacoplado: opcionalmente forwardear al backend interno.
    if (!getWhatsappState(companyId).enabled) return;
    if (message.from === "status@broadcast" || message.from.includes("@g.us")) return;
    const backendInternalUrl = String(process.env.BACKEND_INTERNAL_URL || "").trim();
    if (!backendInternalUrl) {
      console.warn(
        `[${key}] Mensaje entrante ignorado: BACKEND_INTERNAL_URL no está configurado.`,
      );
      return;
    }

    try {
      const url = `${backendInternalUrl.replace(/\/$/, "")}/internal/whatsapp/incoming`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(String(process.env.BACKEND_INTERNAL_TOKEN || "").trim()
            ? { "x-internal-token": String(process.env.BACKEND_INTERNAL_TOKEN).trim() }
            : {}),
        },
        body: JSON.stringify({
          companyId: companyId || null,
          from: message.from,
          body: message.body,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error(`[${key}] Error forward incoming:`, error?.message || error);
    }
  });

  return client;
};

const createEntry = (companyId = null) => ({
  companyId,
  client: createClient(companyId),
  isStarting: false,
  stopRequestedDuringStart: false,
  startPromise: null,
  hasInitialized: false,
});

const ensureEntry = (companyId = null) => {
  const key = buildCompanyKey(companyId);
  if (!clients.has(key)) {
    clients.set(key, createEntry(companyId));
  }
  return clients.get(key);
};

const startClient = async (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const entry = ensureEntry(companyId);
  const { client } = entry;

  if (client.isReady) return client;
  if (entry.isStarting && entry.startPromise) return entry.startPromise;

  entry.stopRequestedDuringStart = false;
  entry.isStarting = true;
  setStartAttempt(companyId, "Inicializando cliente de WhatsApp...");

  entry.startPromise = (async () => {
    try {
      await client.initialize();
      entry.hasInitialized = true;
      return client;
    } catch (error) {
      const message = error?.message || String(error);
      setLastError(companyId, message);
      throw error;
    } finally {
      entry.isStarting = false;
      entry.startPromise = null;
      if (entry.stopRequestedDuringStart) {
        entry.stopRequestedDuringStart = false;
        await stopClient(companyId);
      }
    }
  })();

  return entry.startPromise;
};

const stopClient = async (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const entry = clients.get(key);
  if (!entry) return;

  if (entry.isStarting) {
    entry.stopRequestedDuringStart = true;
    return;
  }

  try {
    await entry.client.destroy();
  } catch {
    // noop
  } finally {
    entry.client.isReady = false;
    console.log(`[WhatsApp][${key}] stop OK.`);
  }
};

const getReadyClient = (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const entry = clients.get(key);

  if (!entry || !entry.hasInitialized || entry.isStarting || !entry.client?.isReady) {
    throw new Error(`El cliente de WhatsApp para '${key}' no está listo.`);
  }

  return entry.client;
};

const restartClient = async (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const entry = clients.get(key);

  if (entry?.isStarting) {
    throw new Error(`Ya hay arranque en curso para '${key}'.`);
  }

  incrementReconnectAttempts(companyId);

  if (entry?.client) {
    try {
      await entry.client.destroy();
    } catch {
      // noop
    }
  }

  clients.set(key, createEntry(companyId));
  return startClient(companyId);
};

module.exports = {
  startClient,
  stopClient,
  getReadyClient,
  restartClient,
};
