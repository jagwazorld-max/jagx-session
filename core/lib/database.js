const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

function defaultData() {
  return {
    users: {},   // jid -> { balance, bank, lastDaily, lastWork, warns, banned }
    groups: {},  // jid -> { antilink, welcome, warns:{jid:count}, welcomeText, goodbyeText }
    chats: {},   // jid (any chat, group or DM) -> { antidelete, antiviewonce }
    settings: {},
  };
}

let data = defaultData();
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } else {
      save(true);
    }
  } catch (e) {
    console.error('[DB] failed to load, starting fresh:', e.message);
    data = defaultData();
  }
  return data;
}

function save(immediate = false) {
  const write = () => {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[DB] save failed:', e.message);
    }
  };
  if (immediate) return write();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 800); // debounce writes
}

function getUser(jid) {
  if (!data.users[jid]) {
    data.users[jid] = { balance: 0, bank: 0, lastDaily: 0, lastWork: 0, warns: 0, banned: false };
    save();
  }
  return data.users[jid];
}

function getGroup(jid) {
  if (!data.groups[jid]) {
    data.groups[jid] = { antilink: false, welcome: false, warns: {}, welcomeText: '', goodbyeText: '', antibadword: false, antispam: false };
    save();
  }
  return data.groups[jid];
}

function getChat(jid) {
  if (!data.chats[jid]) {
    data.chats[jid] = { antidelete: false, antiviewonce: false };
    save();
  }
  return data.chats[jid];
}

load();

module.exports = { data, load, save, getUser, getGroup, getChat };
