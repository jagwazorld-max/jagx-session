const os = require('os');
const moment = require('moment-timezone');
const { loadPlugins } = require('../lib/loadPlugins');

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

module.exports = [
  {
    name: 'menu',
    alias: ['help', 'commands'],
    category: 'general',
    desc: 'Show all available commands',
    run: async (sock, m, args, ctx) => {
      const cmds = loadPlugins();
      const byCategory = {};
      const seen = new Set();
      for (const cmd of cmds.values()) {
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        byCategory[cmd.category] = byCategory[cmd.category] || [];
        byCategory[cmd.category].push(cmd.name);
      }
      let text = `*${ctx.config.BOT_NAME} — Command Menu*\nPrefix: *${ctx.config.PREFIX}*\n\n`;
      for (const cat of Object.keys(byCategory).sort()) {
        text += `*⟢ ${cat.toUpperCase()}*\n`;
        text += byCategory[cat].map((n) => `  ${ctx.config.PREFIX}${n}`).join('\n');
        text += '\n\n';
      }
      text += `Total commands: ${seen.size}`;

      const fs = require('fs');
      if (ctx.ownerImagePath && fs.existsSync(ctx.ownerImagePath)) {
        await sock.sendMessage(m.from, { image: fs.readFileSync(ctx.ownerImagePath), caption: text }, { quoted: m.raw });
      } else {
        await m.reply(text);
      }
    },
  },
  {
    name: 'ping',
    category: 'general',
    desc: 'Check bot response speed',
    run: async (sock, m) => {
      const start = Date.now();
      const sent = await m.reply('Pinging...');
      const ms = Date.now() - start;
      await sock.sendMessage(m.from, { text: `🏓 Pong! ${ms}ms`, edit: sent.key }).catch(() =>
        sock.sendMessage(m.from, { text: `🏓 Pong! ${ms}ms` })
      );
    },
  },
  {
    name: 'alive',
    category: 'general',
    desc: 'Check if the bot is online',
    run: async (sock, m, args, ctx) => {
      await m.reply(`✅ ${ctx.config.BOT_NAME} is alive and running.\nUptime: ${fmtUptime(process.uptime())}`);
    },
  },
  {
    name: 'owner',
    category: 'general',
    desc: 'Get the bot owner contact',
    run: async (sock, m, args, ctx) => {
      await sock.sendMessage(m.from, {
        contacts: {
          displayName: 'Owner',
          contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Owner\nTEL;type=CELL;waid=${ctx.config.OWNER_NUMBER}:+${ctx.config.OWNER_NUMBER}\nEND:VCARD` }],
        },
      });
    },
  },
  {
    name: 'runtime',
    alias: ['uptime'],
    category: 'general',
    desc: 'Show how long the bot has been running',
    run: async (sock, m) => m.reply(`⏱ Uptime: ${fmtUptime(process.uptime())}`),
  },
  {
    name: 'jid',
    category: 'general',
    desc: 'Get the JID of this chat or a tagged user',
    run: async (sock, m) => {
      const target = m.mentioned[0] || m.from;
      await m.reply(`\`${target}\``);
    },
  },
  {
    name: 'speedtest',
    category: 'general',
    desc: 'Rough measure of system + response speed',
    run: async (sock, m) => {
      const t0 = process.hrtime.bigint();
      let x = 0;
      for (let i = 0; i < 5e6; i++) x += i;
      const t1 = process.hrtime.bigint();
      await m.reply(`CPU loop benchmark: ${Number(t1 - t0) / 1e6}ms\nFree memory: ${(os.freemem() / 1024 / 1024).toFixed(1)}MB / ${(os.totalmem() / 1024 / 1024).toFixed(1)}MB`);
    },
  },
  {
    name: 'script',
    alias: ['repo', 'sc'],
    category: 'general',
    desc: 'Get the bot source info',
    run: async (sock, m, args, ctx) => m.reply(`${ctx.config.BOT_NAME} — self-hosted WhatsApp bot.\nRun it on Termux, a VPS, or any Node.js 18+ host. See README.md in the project for full setup.`),
  },
  {
    name: 'donate',
    category: 'general',
    desc: 'Support the bot owner',
    run: async (sock, m) => m.reply('If this bot is useful to you, consider supporting the owner. Ask them for donation details with the .owner command.'),
  },
  {
    name: 'time',
    category: 'general',
    desc: 'Current server time',
    run: async (sock, m) => m.reply(`🕐 ${moment().tz('Africa/Lagos').format('dddd, MMMM Do YYYY, h:mm:ss a')}`),
  },
];
