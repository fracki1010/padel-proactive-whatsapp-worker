const mongoose = require("mongoose");

let connected = false;

const connectDB = async () => {
  if (connected) return mongoose.connection;

  const uri = String(process.env.MONGO_URI || "").trim();
  if (!uri) {
    throw new Error("Falta MONGO_URI para whatsapp-worker");
  }

  await mongoose.connect(uri);
  connected = true;
  return mongoose.connection;
};

module.exports = {
  connectDB,
};
