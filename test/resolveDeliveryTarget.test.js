"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveDeliveryTarget,
  isDirectChatId,
} = require("../src/utils/resolveDeliveryTarget");

const mockClient = { sendMessage: () => {} };

const spyResolvers = () => {
  const calls = { resolveNumber: [], resolveId: [] };
  const resolveNumber = async (chatId, companyId) => {
    calls.resolveNumber.push([chatId, companyId]);
    return "5492622563206";
  };
  const resolveId = async (phoneNumber, client) => {
    calls.resolveId.push([phoneNumber, client]);
    return `${phoneNumber}@c.us`;
  };
  return { calls, deps: { resolveNumber, resolveId } };
};

test("isDirectChatId clasifica @lid y @g.us como directos", () => {
  assert.equal(isDirectChatId("1234567890@lid"), true);
  assert.equal(isDirectChatId("120363000000000000@g.us"), true);
  assert.equal(isDirectChatId("5492622563206@c.us"), false);
  assert.equal(isDirectChatId("5492622563206"), false);
});

test("@lid se envía directo sin resolver número", async () => {
  const { calls, deps } = spyResolvers();
  const result = await resolveDeliveryTarget(
    "1234567890@lid",
    mockClient,
    "company-1",
    deps,
  );

  assert.equal(result, "1234567890@lid");
  assert.equal(calls.resolveNumber.length, 0);
  assert.equal(calls.resolveId.length, 0);
});

test("@g.us se envía directo sin resolver número", async () => {
  const { calls, deps } = spyResolvers();
  const result = await resolveDeliveryTarget(
    "120363000000000000@g.us",
    mockClient,
    "company-1",
    deps,
  );

  assert.equal(result, "120363000000000000@g.us");
  assert.equal(calls.resolveNumber.length, 0);
  assert.equal(calls.resolveId.length, 0);
});

test("@c.us se resuelve al número real y luego al chat ID", async () => {
  const { calls, deps } = spyResolvers();
  const result = await resolveDeliveryTarget(
    "5492622563206@c.us",
    mockClient,
    "company-1",
    deps,
  );

  // Regresión: NO debe devolver el @c.us tal cual; debe pasar por getNumberId.
  assert.equal(result, "5492622563206@c.us");
  assert.deepEqual(calls.resolveNumber, [["5492622563206@c.us", "company-1"]]);
  assert.equal(calls.resolveId.length, 1);
  assert.equal(calls.resolveId[0][0], "5492622563206");
  assert.equal(calls.resolveId[0][1], mockClient);
});

test("número pelado se resuelve directo sin getNumberByUser", async () => {
  const { calls, deps } = spyResolvers();
  const result = await resolveDeliveryTarget(
    "5492622563206",
    mockClient,
    "company-1",
    deps,
  );

  assert.equal(result, "5492622563206@c.us");
  assert.equal(calls.resolveNumber.length, 0);
  assert.equal(calls.resolveId.length, 1);
  assert.equal(calls.resolveId[0][0], "5492622563206");
});

test("si el número no está registrado lanza el error original", async () => {
  const deps = {
    resolveNumber: async () => "5490000000000",
    resolveId: async () => null,
  };

  await assert.rejects(
    () => resolveDeliveryTarget("5490000000000@c.us", mockClient, "company-1", deps),
    /Número 5490000000000 no está registrado en WhatsApp\./,
  );
});

test("chat ID vacío lanza error", async () => {
  const { deps } = spyResolvers();
  await assert.rejects(
    () => resolveDeliveryTarget("   ", mockClient, "company-1", deps),
    /Chat ID vacío para SEND_MESSAGE\./,
  );
});
