const IORedis = require("ioredis");

let redisConnection = null;

const buildRedisOptions = () => {
  const host = String(process.env.REDIS_HOST || "127.0.0.1").trim();
  const port = Number(process.env.REDIS_PORT || 6379);
  const db = Number(process.env.REDIS_DB || 0);
  const password = String(process.env.REDIS_PASSWORD || "").trim();
  const useTls = String(process.env.REDIS_TLS || "false").trim() === "true";

  return {
    host,
    port,
    db,
    ...(password ? { password } : {}),
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
};

const getRedisConnection = () => {
  if (redisConnection) return redisConnection;
  redisConnection = new IORedis(buildRedisOptions());
  return redisConnection;
};

module.exports = {
  getRedisConnection,
};
