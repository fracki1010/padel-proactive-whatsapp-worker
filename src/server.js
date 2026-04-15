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

const startHealthServer = () => {
  const port = Number(process.env.PORT || 3010);
  app.listen(port, () => {
    console.log(`[worker-http] listening on :${port}`);
  });
};

module.exports = {
  startHealthServer,
};
