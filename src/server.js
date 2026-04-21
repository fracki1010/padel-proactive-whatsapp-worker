const { getNumberByUser } = require("./utils/getNumberByUser");
const express = require("express");

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, service: "whatsapp-worker", status: "ok" });
});

app.get("/ready", (_req, res) => {
  res.status(200).json({ success: true, ready: true });
});

app.get("/version", (_req, res) => {
  res.status(200).json({ success: true, version: "1.0.0" });
});

//obtener el numero del cliente a partir del whatsappId (chatId)
app.get("/get-number/:whatsappId", async (req, res) => {
  try {
    const whatsappId = req.params.whatsappId;
    const phoneNumber = await getNumberByUser(whatsappId);
    res.status(200).json({ success: true, phoneNumber });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const startHealthServer = () => {
  const port = Number(process.env.PORT || 3010);
  app.listen(port, () => {
    console.log(`[worker-http] listening on :${port}`);
  });
};

module.exports = {
  startHealthServer,
};
