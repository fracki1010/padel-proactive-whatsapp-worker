const os = require("node:os");
const WorkerHeartbeat = require("../models/workerHeartbeat.model");

const SERVICE_NAME = "whatsapp-worker";

const sendWorkerHeartbeat = async () => {
  await WorkerHeartbeat.findOneAndUpdate(
    { serviceName: SERVICE_NAME },
    {
      $set: {
        serviceName: SERVICE_NAME,
        workerId: `${os.hostname() || "host"}:${process.pid}`,
        host: os.hostname() || null,
        pid: process.pid,
        heartbeatAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = {
  SERVICE_NAME,
  sendWorkerHeartbeat,
};
