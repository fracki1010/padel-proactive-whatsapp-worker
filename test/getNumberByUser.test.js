"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { getNumberByUser } = require("../src/utils/getNumberByUser");

// Builds a fake WhatsApp client with a controllable contact + LID/phone result.
const makeClient = ({ contactNumber = null, lidAndPhone = null, throwOnContact = false } = {}) => ({
  async getContactById() {
    if (throwOnContact) throw new Error("contact not found");
    return contactNumber === null ? null : { number: contactNumber };
  },
  async getContactLidAndPhone() {
    return lidAndPhone;
  },
});

const depsWith = (client) => ({
  getReadyClient: () => client,
});

test("@lid se resuelve al teléfono real vía getContactLidAndPhone", async () => {
  const client = makeClient({
    contactNumber: null,
    lidAndPhone: [{ lid: "38552364683267@lid", pn: "5492622345473@c.us" }],
  });

  const result = await getNumberByUser(
    "38552364683267@lid",
    "company-1",
    depsWith(client),
  );

  assert.equal(result, "5492622345473");
});

test("@lid NO devuelve los dígitos del LID cuando no hay resolución", async () => {
  const client = makeClient({ contactNumber: null, lidAndPhone: [{}] });

  const result = await getNumberByUser(
    "38552364683267@lid",
    "company-1",
    depsWith(client),
  );

  assert.equal(result, "");
});

test("@lid devuelve vacío si el mensaje @lid no tiene pn", async () => {
  const client = makeClient({ contactNumber: null, lidAndPhone: [{ lid: "3855@lid" }] });

  const result = await getNumberByUser("38552364683267@lid", null, depsWith(client));

  assert.equal(result, "");
});

test("@lid nunca acepta sus propios dígitos como phone en el fast path", async () => {
  const client = makeClient({
    contactNumber: "38552364683267",
    lidAndPhone: [{ lid: "38552364683267@lid", pn: "5492622345473@c.us" }],
  });

  const result = await getNumberByUser(
    "38552364683267@lid",
    "company-1",
    depsWith(client),
  );

  assert.equal(result, "5492622345473");
});

test("fast path devuelve contact.number cuando existe (@c.us)", async () => {
  const client = makeClient({ contactNumber: "5492622345473" });

  const result = await getNumberByUser("5492622345473@c.us", null, depsWith(client));

  assert.equal(result, "5492622345473");
});

test("@c.us cae a los dígitos del chatId si el contacto no expone número", async () => {
  const client = makeClient({ contactNumber: null });

  const result = await getNumberByUser("5492622345473@c.us", null, depsWith(client));

  assert.equal(result, "5492622345473");
});

test("número pelado cae a sus dígitos", async () => {
  const client = makeClient({ contactNumber: null });

  const result = await getNumberByUser("549-262-2345473", null, depsWith(client));

  assert.equal(result, "5492622345473");
});

test("no lanza si el cliente no está listo: @lid queda sin resolver", async () => {
  const deps = {
    getReadyClient: () => {
      throw new Error("El cliente de WhatsApp no está listo.");
    },
  };

  const result = await getNumberByUser("38552364683267@lid", "company-1", deps);

  assert.equal(result, "");
});

test("chatId vacío devuelve cadena vacía", async () => {
  const result = await getNumberByUser("   ", "company-1", depsWith(makeClient({})));
  assert.equal(result, "");
});
