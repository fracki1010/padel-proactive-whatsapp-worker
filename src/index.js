require("dotenv").config();

const { connectDB } = require("./config/database");
const { startQueueWorker } = require("./queue/worker");
const { syncAllWhatsappFromConfig } = require("./services/whatsappControl.service");
const { sendWorkerHeartbeat } = require("./services/workerHeartbeat.service");
const { startHealthServer } = require("./server");

const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 10_000);

let heartbeatTimer = null;

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

    startHeartbeatLoop();
    console.log("✅ Heartbeat iniciado");

    await syncAllWhatsappFromConfig();
    console.log("✅ Estado WhatsApp sincronizado desde AppConfig");

    startQueueWorker();
    console.log("✅ BullMQ worker iniciado");

    startHealthServer();
  })
  .catch((error) => {
    console.error("❌ Error inicializando whatsapp-worker:", error?.message || error);
    process.exit(1);
  });
