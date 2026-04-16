const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("node:fs");
const path = require("node:path");
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
const initializing = new Set();

const WA_REMOTE_HTML = String(process.env.WA_REMOTE_HTML || "").trim();
const WA_AUTH_DATA_PATH = String(process.env.WA_AUTH_DATA_PATH || ".wwebjs_auth").trim();
if (WA_AUTH_DATA_PATH) {
  try {
    fs.mkdirSync(WA_AUTH_DATA_PATH, { recursive: true });
  } catch (error) {
    console.warn(
      `[WhatsApp] No se pudo preparar WA_AUTH_DATA_PATH (${WA_AUTH_DATA_PATH}):`,
      error?.message || error,
    );
  }
}

const buildClientId = (companyId = null) => `tenant-${buildCompanyKey(companyId)}`;
const logInit = (companyId = null, message = "") => {
  const key = buildCompanyKey(companyId);
  console.log(`[WA][${key}] ${message}`);
};
const getSessionDirPath = (companyId = null) =>
  path.resolve(WA_AUTH_DATA_PATH, `session-${buildClientId(companyId)}`);
const cleanupChromiumProfileLocks = (companyId = null) => {
  const sessionDir = getSessionDirPath(companyId);
  const lockFiles = ["SingletonLock", "SingletonSocket", "SingletonCookie"];

  for (const fileName of lockFiles) {
    const lockPath = path.join(sessionDir, fileName);
    try {
      fs.rmSync(lockPath, { force: true });
    } catch (error) {
      console.warn(
        `[WA][${buildCompanyKey(companyId)}] no se pudo limpiar lock ${lockPath}:`,
        error?.message || error,
      );
    }
  }
};

const createClient = (companyId = null) => {
  const key = buildCompanyKey(companyId);
  const clientOptions = {
    authStrategy: new LocalAuth({
      clientId: buildClientId(companyId),
      dataPath: WA_AUTH_DATA_PATH,
    }),
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROMIUM_PATH ||
      "/usr/bin/chromium",
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
  };

  if (WA_REMOTE_HTML) {
    clientOptions.webVersionCache = { type: "remote", remotePath: WA_REMOTE_HTML };
  }

  const client = new Client(clientOptions);

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
  client.on("change_state", (state) => {
    console.log(`[WA][${key}] state=${String(state || "unknown")}`);
  });
  client.on("remote_session_saved", () => {
    console.log(`[WA][${key}] remote_session_saved`);
  });

  client.on("auth_failure", (msg) => {
    console.error(`❌ [${key}] auth_failure:`, msg);
    setAuthFailure(companyId, msg);
  });

  client.on("ready", () => {
    client.isReady = true;
    resetReconnectAttempts(companyId);
    setReady(companyId);
    logInit(companyId, "ready");
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
  logInit(companyId, "init requested");
  logInit(companyId, `session dir: ${getSessionDirPath(companyId)}`);
  const entry = ensureEntry(companyId);
  const { client } = entry;

  if (client.isReady) {
    logInit(companyId, "init skipped: already exists");
    return client;
  }
  if (initializing.has(key) || entry.isStarting) {
    logInit(companyId, "init skipped: already initializing");
    return entry.startPromise || client;
  }

  entry.stopRequestedDuringStart = false;
  entry.isStarting = true;
  initializing.add(key);
  setStartAttempt(companyId, "Inicializando cliente de WhatsApp...");

  entry.startPromise = (async () => {
    try {
      try {
        await client.initialize();
      } catch (error) {
        const message = String(error?.message || error);
        const isProfileInUse =
          message.includes("Code: 21") ||
          message.toLowerCase().includes("profile appears to be in use");

        if (!isProfileInUse) throw error;

        logInit(companyId, "profile lock detected, cleaning locks and retrying once");
        cleanupChromiumProfileLocks(companyId);
        await client.destroy().catch(() => null);
        await client.initialize();
      }
      entry.hasInitialized = true;
      return client;
    } catch (error) {
      const message = error?.message || String(error);
      setLastError(companyId, message);
      throw error;
    } finally {
      entry.isStarting = false;
      entry.startPromise = null;
      initializing.delete(key);
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
    clients.set(key, createEntry(companyId));
    initializing.delete(key);
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

  if (entry?.isStarting || initializing.has(key)) {
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

const destroyAllClients = async () => {
  const entries = Array.from(clients.entries());
  for (const [key, entry] of entries) {
    try {
      if (entry?.isStarting && entry?.startPromise) {
        await entry.startPromise.catch(() => null);
      }
      if (entry?.client) {
        await entry.client.destroy();
      }
    } catch {
      // noop
    } finally {
      initializing.delete(key);
    }
  }
  clients.clear();
};

module.exports = {
  startClient,
  stopClient,
  getReadyClient,
  restartClient,
  destroyAllClients,
  hasReadyClient: (companyId = null) => {
    const key = buildCompanyKey(companyId);
    const entry = clients.get(key);
    return Boolean(entry?.client?.isReady);
  },
};
