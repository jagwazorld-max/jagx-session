const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

module.exports = [
  {
    name: 'balance',
    alias: ['bal'],
    category: 'economy',
    desc: 'Check your wallet and bank balance',
    run: async (sock, m, args, ctx) => {
      const target = m.mentioned[0] || m.sender;
      const user = ctx.db.getUser(target);
      await m.reply(`💰 Wallet: ${user.balance}\n🏦 Bank: ${user.bank}`);
    },
  },
  {
    name: 'daily',
    category: 'economy',
    desc: 'Claim your daily reward',
    run: async (sock, m, args, ctx) => {
      const user = ctx.db.getUser(m.sender);
      const now = Date.now();
      if (now - user.lastDaily < DAY) {
        const left = DAY - (now - user.lastDaily);
        return m.reply(`⏳ Come back in ${Math.ceil(left / HOUR)}h for your next daily reward.`);
      }
      user.balance += ctx.config.DAILY_AMOUNT;
      user.lastDaily = now;
      ctx.db.save();
      await m.reply(`✅ You claimed your daily reward of ${ctx.config.DAILY_AMOUNT}!`);
    },
  },
  {
    name: 'work',
    category: 'economy',
    desc: 'Work to earn coins',
    run: async (sock, m, args, ctx) => {
      const user = ctx.db.getUser(m.sender);
      const now = Date.now();
      if (now - user.lastWork < HOUR) {
        const left = HOUR - (now - user.lastWork);
        return m.reply(`⏳ You're tired. Rest for ${Math.ceil(left / 60000)} more minutes.`);
      }
      const earn = Math.floor(Math.random() * (ctx.config.WORK_MAX - ctx.config.WORK_MIN + 1)) + ctx.config.WORK_MIN;
      user.balance += earn;
      user.lastWork = now;
      ctx.db.save();
      await m.reply(`💼 You worked and earned ${earn} coins.`);
    },
  },
  {
    name: 'rob',
    category: 'economy',
    desc: 'Attempt to rob a tagged user',
    run: async (sock, m, args, ctx) => {
      const target = m.mentioned[0];
      if (!target) return m.reply('Tag someone to rob: .rob @user');
      if (target === m.sender) return m.reply("You can't rob yourself.");
      const victim = ctx.db.getUser(target);
      const thief = ctx.db.getUser(m.sender);
      if (victim.balance < 50) return m.reply('That person is too poor to rob.');
      const success = Math.random() < 0.5;
      if (success) {
        const amount = Math.floor(victim.balance * (0.1 + Math.random() * 0.2));
        victim.balance -= amount;
        thief.balance += amount;
        ctx.db.save();
        await m.reply(`🕵️ Success! You stole ${amount} coins.`);
      } else {
        const fine = Math.floor(Math.random() * 100);
        thief.balance = Math.max(0, thief.balance - fine);
        ctx.db.save();
        await m.reply(`🚔 You got caught and paid a fine of ${fine} coins.`);
      }
    },
  },
  {
    name: 'deposit',
    category: 'economy',
    desc: 'Move coins from wallet to bank: .deposit 100',
    run: async (sock, m, args, ctx) => {
      const amount = parseInt(m.args[0], 10);
      const user = ctx.db.getUser(m.sender);
      if (!amount || amount <= 0) return m.reply('Usage: .deposit <amount>');
      if (amount > user.balance) return m.reply('You don\'t have that much in your wallet.');
      user.balance -= amount;
      user.bank += amount;
      ctx.db.save();
      await m.reply(`✅ Deposited ${amount} coins.`);
    },
  },
  {
    name: 'withdraw',
    category: 'economy',
    desc: 'Move coins from bank to wallet: .withdraw 100',
    run: async (sock, m, args, ctx) => {
      const amount = parseInt(m.args[0], 10);
      const user = ctx.db.getUser(m.sender);
      if (!amount || amount <= 0) return m.reply('Usage: .withdraw <amount>');
      if (amount > user.bank) return m.reply("You don't have that much in the bank.");
      user.bank -= amount;
      user.balance += amount;
      ctx.db.save();
      await m.reply(`✅ Withdrew ${amount} coins.`);
    },
  },
  {
    name: 'leaderboard',
    alias: ['lb', 'rich'],
    category: 'economy',
    desc: 'Top 10 richest users',
    run: async (sock, m, args, ctx) => {
      const entries = Object.entries(ctx.db.data.users)
        .map(([jid, u]) => [jid, u.balance + u.bank])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (!entries.length) return m.reply('No data yet.');
      const text = entries.map(([jid, total], i) => `${i + 1}. @${jid.split('@')[0]} — ${total}`).join('\n');
      await sock.sendMessage(m.from, { text: `🏆 *Leaderboard*\n${text}`, mentions: entries.map((e) => e[0]) });
    },
  },
];
