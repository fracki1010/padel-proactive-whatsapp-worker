require("dotenv").config();

const { connectDB } = require("./config/database");
const { startQueueWorker } = require("./queue/worker");
const { syncAllWhatsappFromConfig } = require("./services/whatsappControl.service");
const { sendWorkerHeartbeat } = require("./services/workerHeartbeat.service");
const { startHealthServer } = require("./server");
const { getRedisConnection } = require("./config/redis");
const {
  startDailyAvailabilityDigestMonitor,
} = require("./services/dailyAvailabilityDigest.service");
const { destroyAllClients } = require("./services/whatsappTenantManager.service");

const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 10_000);

let heartbeatTimer = null;
let shuttingDown = false;
let lockRenewTimer = null;

const WORKER_LOCK_KEY = String(process.env.WHATSAPP_WORKER_LOCK_KEY || "wa-worker:singleton").trim();
const WORKER_LOCK_TTL_MS = Number(process.env.WHATSAPP_WORKER_LOCK_TTL_MS || 30000);
const WORKER_ID = `${process.env.HOSTNAME || "host"}:${process.pid}:${Date.now()}`;

const safeLockTtl = () =>
  Number.isFinite(WORKER_LOCK_TTL_MS) && WORKER_LOCK_TTL_MS >= 5000 ? WORKER_LOCK_TTL_MS : 30000;

const acquireWorkerLock = async () => {
  const redis = getRedisConnection();
  const ok = await redis.set(WORKER_LOCK_KEY, WORKER_ID, "PX", safeLockTtl(), "NX");
  if (ok !== "OK") {
    throw new Error(`worker lock already held for key=${WORKER_LOCK_KEY}`);
  }
  console.log(`[worker-lock] acquired key=${WORKER_LOCK_KEY} owner=${WORKER_ID}`);
};

const renewWorkerLock = async () => {
  const redis = getRedisConnection();
  const ttl = safeLockTtl();
  const renewed = await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
    1,
    WORKER_LOCK_KEY,
    WORKER_ID,
    String(ttl),
  );
  if (Number(renewed) !== 1) {
    throw new Error(`worker lock lost key=${WORKER_LOCK_KEY}`);
  }
};

const releaseWorkerLock = async () => {
  const redis = getRedisConnection();
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    WORKER_LOCK_KEY,
    WORKER_ID,
  );
};

const startWorkerLockRenewal = () => {
  if (lockRenewTimer) return;
  const period = Math.max(2000, Math.floor(safeLockTtl() / 3));
  lockRenewTimer = setInterval(() => {
    renewWorkerLock().catch((error) => {
      console.error("[worker-lock] renew failed:", error?.message || error);
      shutdown("lock-lost").catch(() => process.exit(1));
    });
  }, period);
};

const startHeartbeatLoop = () => {
  if (heartbeatTimer) return;

  const beat = () =>
    sendWorkerHeartbeat().catch((error) => {
      console.error("[WorkerHeartbeat] Error:", error?.message || error);
    });

  beat();
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
};

connectDB()
  .then(async () => {
    console.log("✅ Mongo conectado (whatsapp-worker)");
    await acquireWorkerLock();
    startWorkerLockRenewal();

    startHeartbeatLoop();
    console.log("✅ Heartbeat iniciado");

    await syncAllWhatsappFromConfig();
    console.log("✅ Estado WhatsApp sincronizado desde AppConfig");

    startQueueWorker();
    console.log("✅ BullMQ worker iniciado");

    startDailyAvailabilityDigestMonitor();
    console.log("✅ Monitor de disponibilidad diaria iniciado");

    startHealthServer();
  })
  .catch((error) => {
    console.error("❌ Error inicializando whatsapp-worker:", error?.message || error);
    process.exit(1);
  });

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] shutdown requested via ${signal}`);
  if (lockRenewTimer) {
    clearInterval(lockRenewTimer);
    lockRenewTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  try {
    await destroyAllClients();
  } catch (error) {
    console.error("[worker] error during WhatsApp clients shutdown:", error?.message || error);
  }

  try {
    await releaseWorkerLock();
  } catch (error) {
    console.error("[worker-lock] release failed:", error?.message || error);
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch(() => process.exit(0));
});
process.on("SIGINT", () => {
  shutdown("SIGINT").catch(() => process.exit(0));
});
process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled Promise Rejection:", reason);
  shutdown("unhandled-rejection").catch(() => process.exit(1));
});
process.on("uncaughtException", (error) => {
  console.error("[worker] Uncaught Exception:", error);
  shutdown("uncaught-exception").catch(() => process.exit(1));
});
