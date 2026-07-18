const axios = require('axios');
const crypto = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { buildQuotedMessage } = require('../lib/media');

function num(jid) {
  return jid.replace(/[^0-9]/g, '');
}

async function getAdmins(sock, from) {
  const meta = await sock.groupMetadata(from);
  return meta.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
}

module.exports = [
  {
    name: 'tagadmins',
    category: 'group',
    desc: 'Mention only the group admins',
    run: async (sock, m) => {
      if (!m.isGroup) return m.reply('Group only.');
      const admins = await getAdmins(sock, m.from);
      if (!admins.length) return m.reply('No admins found.');
      const mentions = admins.map((a) => a.id);
      const text = `*Group admins:*\n` + mentions.map((j) => `@${num(j)}`).join('\n');
      await sock.sendMessage(m.from, { text, mentions });
    },
  },
  {
    name: 'listadmins',
    category: 'group',
    desc: 'List the group admins',
    run: async (sock, m) => {
      if (!m.isGroup) return m.reply('Group only.');
      const admins = await getAdmins(sock, m.from);
      if (!admins.length) return m.reply('No admins found.');
      await m.reply(`👑 *Admins (${admins.length})*\n` + admins.map((a) => `- ${num(a.id)}`).join('\n'));
    },
  },
  {
    name: 'setgpp',
    category: 'group',
    desc: 'Reply to an image with .setgpp to set it as the group icon (admin only)',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      if (!m.quoted || !m.quoted.imageMessage) return m.reply('Reply to an image with .setgpp');
      try {
        const fakeMsg = buildQuotedMessage(m);
        const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
        await sock.updateProfilePicture(m.from, buffer);
        await m.reply('✅ Group icon updated.');
      } catch (e) {
        await m.reply('Could not update the icon: ' + e.message);
      }
    },
  },
  {
    name: 'getpp',
    category: 'group',
    desc: 'Get the profile picture of a tagged user (or yourself)',
    run: async (sock, m) => {
      const target = m.mentioned[0] || m.sender;
      try {
        const url = await sock.profilePictureUrl(target, 'image');
        await sock.sendMessage(m.from, { image: { url }, caption: `📸 @${num(target)}`, mentions: [target] }, { quoted: m.raw });
      } catch {
        await m.reply('That user has no visible profile picture.');
      }
    },
  },
  {
    name: 'block',
    category: 'owner',
    desc: 'Block a WhatsApp user (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const target = m.mentioned[0] || (m.args[0] ? `${m.args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
      if (!target) return m.reply('Usage: .block 234xxxxxxxxxx (or tag someone)');
      await sock.updateBlockStatus(target, 'block');
      await m.reply('🚫 Blocked.');
    },
  },
  {
    name: 'unblock',
    category: 'owner',
    desc: 'Unblock a WhatsApp user (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const target = m.mentioned[0] || (m.args[0] ? `${m.args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
      if (!target) return m.reply('Usage: .unblock 234xxxxxxxxxx (or tag someone)');
      await sock.updateBlockStatus(target, 'unblock');
      await m.reply('✅ Unblocked.');
    },
  },
  {
    name: 'poll',
    category: 'tools',
    desc: 'Create a poll: .poll Question? | Option A | Option B | Option C',
    run: async (sock, m) => {
      const parts = m.text.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 3) return m.reply('Usage: .poll Question? | Option A | Option B');
      const [name, ...values] = parts;
      await sock.sendMessage(m.from, { poll: { name, values, selectableCount: 1 } });
    },
  },
  {
    name: 'location',
    category: 'tools',
    desc: 'Send a location pin: .location <lat> <long> <name>',
    run: async (sock, m) => {
      const [lat, long, ...nameParts] = m.args;
      if (!lat || !long) return m.reply('Usage: .location 6.5244 3.3792 Lagos');
      await sock.sendMessage(m.from, {
        location: { degreesLatitude: parseFloat(lat), degreesLongitude: parseFloat(long), name: nameParts.join(' ') || undefined },
      });
    },
  },
  {
    name: 'vcard',
    category: 'tools',
    desc: 'Generate a contact card: .vcard 234xxxxxxxxxx Name',
    run: async (sock, m) => {
      const [number, ...nameParts] = m.args;
      if (!number) return m.reply('Usage: .vcard 234xxxxxxxxxx John Doe');
      const name = nameParts.join(' ') || 'Contact';
      const digits = number.replace(/[^0-9]/g, '');
      await sock.sendMessage(m.from, {
        contacts: { displayName: name, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;waid=${digits}:+${digits}\nEND:VCARD` }] },
      });
    },
  },
  {
    name: 'trivia',
    category: 'fun',
    desc: 'Get a random trivia question',
    run: async (sock, m) => {
      try {
        const { data } = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
        const q = data.results[0];
        const options = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
        const decode = (s) => s.replace(/&#?\w+;/g, (e) => ({ '&amp;': '&', '&quot;': '"', '&#039;': "'" }[e] || e));
        await m.reply(`🧩 *${decode(q.question)}*\n\n${options.map((o, i) => `${i + 1}. ${decode(o)}`).join('\n')}\n\n_Reply with the number to guess (not auto-checked)._`);
      } catch {
        await m.reply('Trivia service unavailable right now.');
      }
    },
  },
  {
    name: 'password',
    alias: ['genpass'],
    category: 'tools',
    desc: 'Generate a secure random password: .password 16',
    run: async (sock, m) => {
      const len = Math.min(64, Math.max(6, parseInt(m.args[0], 10) || 16));
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
      let pass = '';
      const bytes = crypto.randomBytes(len);
      for (let i = 0; i < len; i++) pass += chars[bytes[i] % chars.length];
      await m.reply(`🔑 \`${pass}\``);
    },
  },
  {
    name: 'setwelcome',
    category: 'group',
    desc: 'Customize the welcome message (admin only). Use {user} and {group} as placeholders.',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      if (!m.text) return m.reply('Usage: .setwelcome Welcome {user} to {group}!');
      const group = ctx.db.getGroup(m.from);
      group.welcomeText = m.text;
      ctx.db.save();
      await m.reply('✅ Welcome message updated. Make sure .welcome is turned on too.');
    },
  },
  {
    name: 'setgoodbye',
    category: 'group',
    desc: 'Customize the goodbye message (admin only). Use {user} and {group} as placeholders.',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      if (!m.text) return m.reply('Usage: .setgoodbye {user} left {group}, we\'ll miss you!');
      const group = ctx.db.getGroup(m.from);
      group.goodbyeText = m.text;
      ctx.db.save();
      await m.reply('✅ Goodbye message updated. Make sure .welcome is turned on too.');
    },
  },
  {
    name: 'resetwarns',
    category: 'moderation',
    desc: 'Clear all warnings in this group (admin only)',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      const group = ctx.db.getGroup(m.from);
      group.warns = {};
      ctx.db.save();
      await m.reply('✅ All warnings in this group cleared.');
    },
  },
  {
    name: 'whoami',
    category: 'general',
    desc: 'Show your stats known to the bot',
    run: async (sock, m, args, ctx) => {
      const user = ctx.db.getUser(m.sender);
      let warns = 0;
      if (m.isGroup) warns = ctx.db.getGroup(m.from).warns[m.sender] || 0;
      await m.reply(`👤 *${num(m.sender)}*\nWallet: ${user.balance}\nBank: ${user.bank}\nWarnings here: ${warns}\nBanned: ${user.banned ? 'yes' : 'no'}`);
    },
  },
  {
    name: 'coinflip',
    alias: ['flip'],
    category: 'fun',
    desc: 'Flip a coin',
    run: async (sock, m) => m.reply(Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!'),
  },
  {
    name: 'dice',
    alias: ['roll'],
    category: 'fun',
    desc: 'Roll a six-sided die',
    run: async (sock, m) => m.reply(`🎲 You rolled a ${Math.floor(Math.random() * 6) + 1}`),
  },
  {
    name: 'eightball',
    alias: ['8ball'],
    category: 'fun',
    desc: 'Ask the magic 8-ball a question',
    run: async (sock, m) => {
      const answers = ['Yes, definitely.', 'No.', 'Ask again later.', 'Absolutely!', 'Very doubtful.', 'It is certain.', 'Cannot predict now.', 'Signs point to yes.'];
      if (!m.text) return m.reply('Usage: .8ball Will it rain today?');
      await m.reply(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
    },
  },
  {
    name: 'base64',
    category: 'tools',
    desc: 'Encode or decode base64: .base64 encode <text> | .base64 decode <text>',
    run: async (sock, m) => {
      const [mode, ...rest] = m.args;
      const text = rest.join(' ');
      if (!['encode', 'decode'].includes(mode) || !text) return m.reply('Usage: .base64 encode <text>  OR  .base64 decode <text>');
      try {
        const out = mode === 'encode' ? Buffer.from(text, 'utf-8').toString('base64') : Buffer.from(text, 'base64').toString('utf-8');
        await m.reply(out);
      } catch {
        await m.reply('Could not process that input.');
      }
    },
  },
  {
    name: 'hex',
    category: 'tools',
    desc: 'Get RGB values for a hex color: .hex #ff6600',
    run: async (sock, m) => {
      const hex = (m.args[0] || '').replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return m.reply('Usage: .hex #rrggbb');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      await m.reply(`🎨 #${hex}\nRGB: ${r}, ${g}, ${b}`);
    },
  },
];
