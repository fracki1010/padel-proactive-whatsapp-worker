const os = require("node:os");
const WhatsappCommand = require("../models/whatsappCommand.model");
const { setWhatsappEnabled } = require("../services/whatsappControl.service");
const { getReadyClient, restartClient } = require("../services/whatsappTenantManager.service");
const { listWhatsappGroups, notifyCancellationToGroup } = require("../services/whatsappCancellationGroup.service");
const { saveWhatsappGroupsSnapshot } = require("../services/whatsappGroupsSnapshot.service");

const COMMAND_TYPES = {
  SET_ENABLED: "set_enabled",
  SEND_MESSAGE: "send_message",
  RESTART_CLIENT: "restart_client",
  LIST_GROUPS: "list_groups",
  NOTIFY_CANCELLATION_GROUP: "notify_cancellation_group",
};

const normalizeCompanyId = (companyId = null) => companyId || null;
const workerId = `wa-bullmq-worker:${os.hostname() || "host"}:${process.pid}`;

const markProcessing = async ({ commandId, attempt }) => {
  await WhatsappCommand.findByIdAndUpdate(commandId, {
    $set: {
      status: "processing",
      lockedAt: new Date(),
      lockedBy: workerId,
      processedAt: null,
      lastError: null,
      attempts: Number(attempt || 1),
    },
  });
};

const markDone = async (commandId) => {
  await WhatsappCommand.findByIdAndUpdate(commandId, {
    $set: {
      status: "done",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
};

const markFailed = async ({ commandId, errorMessage, finalFailure = false }) => {
  await WhatsappCommand.findByIdAndUpdate(commandId, {
    $set: {
      status: finalFailure ? "failed" : "queued",
      processedAt: finalFailure ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
      lastError: String(errorMessage || "Error desconocido"),
    },
  });
};

const executeCommand = async ({ companyId, type, payload }) => {
  if (type === COMMAND_TYPES.SET_ENABLED) {
    await setWhatsappEnabled(Boolean(payload?.enabled), companyId);
    return;
  }

  if (type === COMMAND_TYPES.SEND_MESSAGE) {
    const to = String(payload?.to || "").trim();
    const message = String(payload?.message || "");
    if (!to || !message.trim()) {
      throw new Error("Payload inválido para SEND_MESSAGE.");
    }

    const client = getReadyClient(companyId);
    await client.sendMessage(to, message);
    return;
  }

  if (type === COMMAND_TYPES.RESTART_CLIENT) {
    await restartClient(companyId);
    return;
  }

  if (type === COMMAND_TYPES.LIST_GROUPS) {
    const groups = await listWhatsappGroups(companyId);
    await saveWhatsappGroupsSnapshot(companyId, groups, new Date());
    return;
  }

  if (type === COMMAND_TYPES.NOTIFY_CANCELLATION_GROUP) {
    await notifyCancellationToGroup({
      companyId,
      booking: payload?.booking || null,
      time: payload?.time,
      courtName: payload?.courtName,
    });
    return;
  }

  throw new Error(`Tipo de comando no soportado: ${type}`);
};

const processWhatsappCommandJob = async (job) => {
  const commandId = String(job?.data?.commandId || "").trim();
  if (!commandId) {
    throw new Error("Job sin commandId");
  }

  const command = await WhatsappCommand.findById(commandId).lean();
  if (!command) {
    throw new Error(`Comando inexistente: ${commandId}`);
  }

  const currentAttempt = Number(job.attemptsMade || 0) + 1;
  await markProcessing({ commandId, attempt: currentAttempt });

  const companyId = normalizeCompanyId(command.companyId || job?.data?.companyId || null);
  const type = String(command.type || job?.data?.type || "").trim();
  const payload =
    command.payload && typeof command.payload === "object"
      ? command.payload
      : job?.data?.payload && typeof job.data.payload === "object"
        ? job.data.payload
        : {};

  try {
    await executeCommand({ companyId, type, payload });
    await markDone(commandId);
  } catch (error) {
    const message = String(error?.message || error || "Error desconocido");
    const maxAttempts = Number(command.maxAttempts || 3);
    const finalFailure = currentAttempt >= maxAttempts;
    await markFailed({ commandId, errorMessage: message, finalFailure });
    throw error;
  }
};

module.exports = {
  processWhatsappCommandJob,
};
