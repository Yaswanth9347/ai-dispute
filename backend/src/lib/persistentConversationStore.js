const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../backend_data');
const FILE_PATH = path.join(DATA_DIR, 'conversations.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function loadAll() {
  try {
    ensureDataDir();
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8');
      return {};
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.warn('[persistentConversationStore] load error', e?.message || e);
    return {};
  }
}

function saveAll(obj) {
  try {
    ensureDataDir();
    fs.writeFileSync(FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[persistentConversationStore] save error', e?.message || e);
  }
}

// in-memory mirror to reduce fs reads
let cache = loadAll();

function get(userId) {
  if (!userId) return { history: [], language: 'English' };
  return cache[userId] || { history: [], language: 'English' };
}

function set(userId, value) {
  if (!userId) return;
  cache[userId] = value;
  saveAll(cache);
}

function appendMessage(userId, messageObj, maxHistory = 200) {
  if (!userId) return;
  const cur = cache[userId] || { history: [], language: 'English' };
  cur.history = cur.history || [];
  cur.history.push(messageObj);
  if (cur.history.length > maxHistory) cur.history = cur.history.slice(-maxHistory);
  cache[userId] = cur;
  saveAll(cache);
}

function clear(userId) {
  if (!userId) return;
  delete cache[userId];
  saveAll(cache);
}

module.exports = { get, set, appendMessage, clear };
