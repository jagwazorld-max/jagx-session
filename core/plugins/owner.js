const fs = require('fs');
const path = require('path');

module.exports = [
  {
    name: 'broadcast',
    alias: ['bc'],
    category: 'owner',
    desc: 'Send a message to every chat the bot has seen (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      if (!m.text) return m.reply('Usage: .broadcast <message>');
      const chats = new Set([
        ...Object.keys(ctx.db.data.groups),
        ...Object.keys(ctx.db.data.users).map((j) => j),
      ]);
      let sent = 0;
      for (const jid of chats) {
        try {
          await sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${m.text}` });
          sent++;
        } catch {
          // ignore unreachable chats
        }
      }
      await m.reply(`✅ Broadcast sent to ${sent} chat(s).`);
    },
  },
  {
    name: 'setprefix',
    category: 'owner',
    desc: 'Change the command prefix (owner only, this session)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const newPrefix = m.args[0];
      if (!newPrefix) return m.reply('Usage: .setprefix !');
      ctx.config.PREFIX = newPrefix;
      await m.reply(`✅ Prefix changed to "${newPrefix}" for this run.\nTo make it permanent, set BOT_PREFIX=${newPrefix} in your .env file.`);
    },
  },
  {
    name: 'restart',
    category: 'owner',
    desc: 'Restart the bot process (owner only, needs pm2 or a process manager)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      await m.reply('♻️ Restarting...');
      process.exit(0); // pm2 / nodemon / termux-services will bring it back up
    },
  },
  {
    name: 'eval',
    category: 'owner',
    desc: 'Run raw JS for debugging (owner only, use with care)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      if (!m.text) return m.reply('Usage: .eval <js code>');
      try {
        // eslint-disable-next-line no-eval
        let result = await eval(m.text);
        if (typeof result !== 'string') result = require('util').inspect(result);
        await m.reply(result.slice(0, 4000));
      } catch (e) {
        await m.reply('Error: ' + e.message);
      }
    },
  },
  {
    name: 'stats',
    category: 'owner',
    desc: 'Show bot usage stats (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const users = Object.keys(ctx.db.data.users).length;
      const groups = Object.keys(ctx.db.data.groups).length;
      await m.reply(`📊 Users tracked: ${users}\nGroups tracked: ${groups}\nMemory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}MB`);
    },
  },
];
