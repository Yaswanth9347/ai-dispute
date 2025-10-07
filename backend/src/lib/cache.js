const Redis = require('ioredis');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let client;
function getClient() {
  if (!client) client = new Redis(redisUrl);
  return client;
}

async function get(key) {
  const c = getClient();
  const v = await c.get(key);
  return v ? JSON.parse(v) : null;
}

async function set(key, value, ttlSec) {
  const c = getClient();
  const s = JSON.stringify(value);
  if (ttlSec) {
    await c.set(key, s, 'EX', ttlSec);
  } else {
    await c.set(key, s);
  }
}

async function del(key) {
  const c = getClient();
  await c.del(key);
}

module.exports = { getClient, get, set, del };
