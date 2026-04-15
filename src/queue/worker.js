const { Worker, QueueEvents } = require("bullmq");
const { getRedisConnection } = require("../config/redis");
const { processWhatsappCommandJob } = require("./commandProcessor");

const queueName = String(process.env.WHATSAPP_QUEUE_NAME || "whatsapp-commands").trim();
const concurrency = Number(process.env.WORKER_CONCURRENCY || 2);

let workerInstance = null;
let queueEvents = null;

const startQueueWorker = () => {
  if (workerInstance) return workerInstance;

  const connection = getRedisConnection();

  workerInstance = new Worker(queueName, processWhatsappCommandJob, {
    connection,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2,
  });

  queueEvents = new QueueEvents(queueName, { connection });

  workerInstance.on("completed", (job) => {
    console.log(`[BullMQ] completed job=${job?.id || "n/a"}`);
  });

  workerInstance.on("failed", (job, error) => {
    console.error(
      `[BullMQ] failed job=${job?.id || "n/a"}:`,
      error?.message || error,
    );
  });

  queueEvents.on("error", (error) => {
    console.error("[BullMQ] QueueEvents error:", error?.message || error);
  });

  return workerInstance;
};

module.exports = {
  startQueueWorker,
};
