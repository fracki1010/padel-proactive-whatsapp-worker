const os = require("node:os");
const WhatsappCommand = require("../models/whatsappCommand.model");
const { setWhatsappEnabled } = require("../services/whatsappControl.service");
const { getReadyClient, restartClient } = require("../services/whatsappTenantManager.service");
const { resetClientSession } = require("../services/whatsappTenantManager.service");
const { listWhatsappGroups, notifyCancellationToGroup } = require("../services/whatsappCancellationGroup.service");
const { saveWhatsappGroupsSnapshot } = require("../services/whatsappGroupsSnapshot.service");
const { obtenerIdDeNumero } = require("../utils/getIdByNumber");
const { getNumberByUser } = require("../utils/getNumberByUser");

const COMMAND_TYPES = {
  SET_ENABLED: "set_enabled",
  SEND_MESSAGE: "send_message",
  RESTART_CLIENT: "restart_client",
  RESET_SESSION: "reset_session",
  LIST_GROUPS: "list_groups",
  NOTIFY_CANCELLATION_GROUP: "notify_cancellation_group",
  SEND_DIGEST_NOW: "send_digest_now",
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
  console.log(`[commandProcessor] executeCommand type=${type} companyId=${companyId}`);

  if (type === COMMAND_TYPES.SET_ENABLED) {
    await setWhatsappEnabled(Boolean(payload?.enabled), companyId);
    return;
  }

  if (type === COMMAND_TYPES.SEND_MESSAGE) {
    const rawTo = String(payload?.to || "").trim();
    const message = String(payload?.message || "");
    if (!rawTo || !message.trim()) {
      throw new Error("Payload inválido para SEND_MESSAGE.");
    }

    const client = getReadyClient(companyId);

    let phoneNumber;
    if (rawTo.includes("@")) {
      // Es un WhatsApp ID (ej: @lid, @c.us) → convertir al número real primero
      console.log(`[commandProcessor] SEND_MESSAGE → rawTo=${rawTo} tiene @, convirtiendo con getNumberByUser...`);
      phoneNumber = await getNumberByUser(rawTo, companyId);
      console.log(`[commandProcessor] número real resuelto → ${phoneNumber}`);
    } else {
      phoneNumber = rawTo;
    }

    console.log(`[commandProcessor] SEND_MESSAGE → phoneNumber=${phoneNumber}, resolviendo ID con getNumberId...`);
    const resolvedTo = await obtenerIdDeNumero(phoneNumber, client);
    if (!resolvedTo) {
      throw new Error(`Número ${phoneNumber} no está registrado en WhatsApp.`);
    }

    console.log(`[commandProcessor] ID resuelto → ${resolvedTo}, enviando mensaje...`);
    await client.sendMessage(resolvedTo, message);
    console.log(`[commandProcessor] mensaje enviado OK → to=${resolvedTo}`);
    return;
  }

  if (type === COMMAND_TYPES.RESTART_CLIENT) {
    await restartClient(companyId);
    return;
  }

  if (type === COMMAND_TYPES.RESET_SESSION) {
    await resetClientSession(companyId);
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

  if (type === COMMAND_TYPES.SEND_DIGEST_NOW) {
    const { triggerDigestNow } = require("../services/dailyAvailabilityDigest.service");
    await triggerDigestNow(companyId);
    return;
  }

  throw new Error(`Tipo de comando no soportado: ${type}`);
};

const processWhatsappCommandJob = async (job) => {
  console.log(`[commandProcessor] job recibido → jobId=${job?.id} data=${JSON.stringify(job?.data)}`);
  const commandId = String(job?.data?.commandId || "").trim();
  if (!commandId) {
    throw new Error("Job sin commandId");
  }

  const command = await WhatsappCommand.findById(commandId).lean();
  if (!command) {
    throw new Error(`Comando inexistente: ${commandId}`);
  }

  const currentAttempt = Number(job.attemptsMade || 0) + 1;
  console.log(`[commandProcessor] procesando commandId=${commandId} type=${command.type} attempt=${currentAttempt}`);
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
