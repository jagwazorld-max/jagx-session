const axios = require('axios');
const fs = require('fs');
const path = require('path');

const roasts = [
  "You're the reason the gene pool needs a lifeguard.",
  "I'd explain it to you, but I left my crayons at home.",
  "You bring everyone so much joy... when you leave the room.",
  "You're not stupid, you just have bad luck thinking.",
  "I'm not saying you're slow, but you'd lose a race to a sloth on a break.",
];
const compliments = [
  "You have a way of making hard things look easy.",
  "Your energy is contagious in the best way.",
  "You notice things most people miss.",
  "You're the kind of person people remember for years.",
  "You make the people around you better.",
];

const COUNTRY_CODES = {
  '1': 'USA/Canada', '44': 'United Kingdom', '234': 'Nigeria', '233': 'Ghana',
  '254': 'Kenya', '27': 'South Africa', '91': 'India', '86': 'China',
  '81': 'Japan', '49': 'Germany', '33': 'France', '39': 'Italy',
  '61': 'Australia', '971': 'UAE', '20': 'Egypt', '55': 'Brazil', '52': 'Mexico',
};
function guessCountry(digits) {
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len);
    if (COUNTRY_CODES[prefix]) return COUNTRY_CODES[prefix];
  }
  return 'Unknown';
}

// In-memory reminder store — lost on restart, which is fine for short-term nudges.
const reminders = new Map(); // sender jid -> [{ text, at }]

module.exports = [
  {
    name: 'remind',
    category: 'tools',
    desc: 'Set a reminder: .remind 10m Buy milk (supports m/h, e.g. 30m, 2h)',
    run: async (sock, m) => {
      const match = (m.args[0] || '').match(/^(\d+)(m|h)$/i);
      const text = m.args.slice(1).join(' ');
      if (!match || !text) return m.reply('Usage: .remind 10m Buy milk  (or 2h Call mum)');
      const amount = parseInt(match[1], 10);
      const ms = match[2].toLowerCase() === 'h' ? amount * 3600000 : amount * 60000;
      if (ms > 24 * 3600000) return m.reply('Max reminder window is 24h.');
      setTimeout(() => {
        sock.sendMessage(m.sender, { text: `⏰ Reminder: ${text}` }).catch(() => {});
      }, ms);
      const list = reminders.get(m.sender) || [];
      list.push({ text, at: Date.now() + ms });
      reminders.set(m.sender, list);
      await m.reply(`✅ I'll remind you in ${match[1]}${match[2]}: "${text}"`);
    },
  },
  {
    name: 'remindlist',
    category: 'tools',
    desc: 'Show your pending reminders',
    run: async (sock, m) => {
      const list = (reminders.get(m.sender) || []).filter((r) => r.at > Date.now());
      if (!list.length) return m.reply('No pending reminders.');
      await m.reply(list.map((r) => `- ${r.text} (in ${Math.ceil((r.at - Date.now()) / 60000)}m)`).join('\n'));
    },
  },
  {
    name: 'anon',
    category: 'group',
    desc: 'Post a message anonymously in the group (bot must be admin to delete your original)',
    run: async (sock, m) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!m.text) return m.reply('Usage: .anon Your message here');
      await sock.sendMessage(m.from, { delete: m.key }).catch(() => {});
      await sock.sendMessage(m.from, { text: `🕶️ *Anonymous:*\n${m.text}` });
    },
  },
  {
    name: 'roast',
    category: 'fun',
    desc: 'Get a random playful roast',
    run: async (sock, m) => m.reply(`🔥 ${roasts[Math.floor(Math.random() * roasts.length)]}`),
  },
  {
    name: 'compliment',
    category: 'fun',
    desc: 'Get a random compliment',
    run: async (sock, m) => m.reply(`💛 ${compliments[Math.floor(Math.random() * compliments.length)]}`),
  },
  {
    name: 'advice',
    category: 'fun',
    desc: 'Get a random piece of life advice',
    run: async (sock, m) => {
      try {
        const { data } = await axios.get('https://api.adviceslip.com/advice');
        await m.reply(`💭 ${data.slip.advice}`);
      } catch {
        await m.reply('Advice service unavailable right now.');
      }
    },
  },
  {
    name: 'antispam',
    category: 'moderation',
    desc: 'Delete messages from users spamming (5+ messages in 10s): .antispam on/off',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .antispam on | .antispam off');
      const group = ctx.db.getGroup(m.from);
      group.antispam = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Antispam turned ${mode}.`);
    },
  },
  {
    name: 'autoreply',
    category: 'owner',
    desc: 'Manage keyword auto-replies (owner only): .autoreply add hello|Hi there! · .autoreply list · .autoreply del hello',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const sub = (m.args[0] || '').toLowerCase();
      ctx.db.data.settings.autoreplies = ctx.db.data.settings.autoreplies || {};
      const replies = ctx.db.data.settings.autoreplies;

      if (sub === 'add') {
        const rest = m.text.slice(4).trim();
        const [keyword, ...respParts] = rest.split('|');
        const response = respParts.join('|').trim();
        if (!keyword?.trim() || !response) return m.reply('Usage: .autoreply add keyword|response text');
        replies[keyword.trim().toLowerCase()] = response;
        ctx.db.save();
        await m.reply(`✅ Auto-reply added for "${keyword.trim()}".`);
      } else if (sub === 'list') {
        const keys = Object.keys(replies);
        if (!keys.length) return m.reply('No auto-replies set.');
        await m.reply(keys.map((k) => `- ${k}`).join('\n'));
      } else if (sub === 'del') {
        const keyword = m.args.slice(1).join(' ').toLowerCase();
        if (!replies[keyword]) return m.reply('No auto-reply found for that keyword.');
        delete replies[keyword];
        ctx.db.save();
        await m.reply('✅ Removed.');
      } else {
        await m.reply('Usage:\n.autoreply add keyword|response text\n.autoreply list\n.autoreply del keyword');
      }
    },
  },
  {
    name: 'exportdata',
    category: 'owner',
    desc: 'Export the bot\'s database as a file (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const dbPath = path.join(__dirname, '..', 'data', 'database.json');
      if (!fs.existsSync(dbPath)) return m.reply('No data to export yet.');
      await sock.sendMessage(m.from, {
        document: fs.readFileSync(dbPath),
        fileName: `jagx-backup-${Date.now()}.json`,
        mimetype: 'application/json',
      });
    },
  },
  {
    name: 'cleardb',
    category: 'owner',
    desc: 'Wipe all economy/warns/settings data (owner only): .cleardb CONFIRM',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      if (m.args[0] !== 'CONFIRM') return m.reply('This wipes ALL saved data. To proceed: .cleardb CONFIRM');
      ctx.db.data.users = {};
      ctx.db.data.groups = {};
      ctx.db.data.chats = {};
      ctx.db.data.settings = {};
      ctx.db.save();
      await m.reply('🗑️ All data wiped.');
    },
  },
  {
    name: 'whois',
    category: 'tools',
    desc: 'Best-effort guess at which country a number belongs to: .whois 234803...',
    run: async (sock, m) => {
      const target = m.mentioned[0] || m.args[0];
      if (!target) return m.reply('Usage: .whois 234xxxxxxxxxx (or tag someone)');
      const digits = target.replace(/[^0-9]/g, '');
      await m.reply(`📞 ${digits}\nLikely country: ${guessCountry(digits)}\n\n(Best-effort guess from the calling code prefix, not a verified lookup.)`);
    },
  },
];
