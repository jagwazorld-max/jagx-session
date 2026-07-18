function num(jid) {
  return jid.replace(/[^0-9]/g, '');
}

const ZODIAC = [
  [120, 'Capricorn'], [219, 'Aquarius'], [320, 'Pisces'], [420, 'Aries'],
  [521, 'Taurus'], [621, 'Gemini'], [722, 'Cancer'], [823, 'Leo'],
  [923, 'Virgo'], [1023, 'Libra'], [1122, 'Scorpio'], [1222, 'Sagittarius'], [1231, 'Capricorn'],
];
function getZodiac(month, day) {
  const key = month * 100 + day;
  for (const [cutoff, sign] of ZODIAC) if (key <= cutoff) return sign;
  return 'Capricorn';
}

module.exports = [
  {
    name: 'antibadword',
    category: 'moderation',
    desc: 'Delete messages containing common profanity: .antibadword on/off',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin) return m.reply('❌ Admins only.');
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .antibadword on | .antibadword off');
      const group = ctx.db.getGroup(m.from);
      group.antibadword = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Bad word filter turned ${mode}.`);
    },
  },
  {
    name: 'anticall',
    category: 'owner',
    desc: 'Automatically reject and block incoming calls to this bot: .anticall on/off',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const mode = (m.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(mode)) return m.reply('Usage: .anticall on | .anticall off');
      ctx.db.data.settings.anticall = mode === 'on';
      ctx.db.save();
      await m.reply(`✅ Anticall turned ${mode}.`);
    },
  },
  {
    name: 'setbio',
    category: 'owner',
    desc: 'Update the bot account\'s About/status text (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      if (!m.text) return m.reply('Usage: .setbio Powered by JagX 🤖');
      await sock.updateProfileStatus(m.text);
      await m.reply('✅ Bio updated.');
    },
  },
  {
    name: 'setpname',
    category: 'owner',
    desc: 'Update the bot account\'s display name (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      if (!m.text) return m.reply('Usage: .setpname JagX');
      await sock.updateProfileName(m.text);
      await m.reply('✅ Display name updated.');
    },
  },
  {
    name: 'listgroups',
    category: 'owner',
    desc: 'List every group the bot is currently in (owner only)',
    run: async (sock, m, args, ctx) => {
      if (!ctx.isOwner) return m.reply('❌ Owner only.');
      const groups = await sock.groupFetchAllParticipating();
      const list = Object.values(groups);
      if (!list.length) return m.reply('Not in any groups yet.');
      await m.reply(`👥 *Groups (${list.length})*\n` + list.map((g) => `- ${g.subject}`).join('\n'));
    },
  },
  {
    name: 'leavegroup',
    category: 'group',
    desc: 'Make the bot leave the current group (admin only)',
    run: async (sock, m, args, ctx) => {
      if (!m.isGroup) return m.reply('Group only.');
      if (!ctx.isSenderAdmin && !ctx.isOwner) return m.reply('❌ Admins only.');
      await m.reply('👋 Leaving this group.');
      await sock.groupLeave(m.from);
    },
  },
  {
    name: 'zodiac',
    category: 'fun',
    desc: 'Get a zodiac sign from a birthday: .zodiac 04-20',
    run: async (sock, m) => {
      const match = (m.args[0] || '').match(/^(\d{1,2})-(\d{1,2})$/);
      if (!match) return m.reply('Usage: .zodiac MM-DD (e.g. .zodiac 04-20)');
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) return m.reply('That\'s not a valid date.');
      await m.reply(`♈ Your zodiac sign is *${getZodiac(month, day)}*.`);
    },
  },
  {
    name: 'bmi',
    category: 'tools',
    desc: 'Calculate BMI: .bmi <kg> <cm>',
    run: async (sock, m) => {
      const [kg, cm] = m.args.map(Number);
      if (!kg || !cm) return m.reply('Usage: .bmi 70 175  (weight in kg, height in cm)');
      const meters = cm / 100;
      const bmi = kg / (meters * meters);
      let category = 'Normal weight';
      if (bmi < 18.5) category = 'Underweight';
      else if (bmi >= 25 && bmi < 30) category = 'Overweight';
      else if (bmi >= 30) category = 'Obese';
      await m.reply(`⚖️ BMI: ${bmi.toFixed(1)} (${category})\n\nThis is a rough general-population estimate, not medical advice.`);
    },
  },
  {
    name: 'age',
    category: 'tools',
    desc: 'Calculate age from a birth date: .age 2000-05-14',
    run: async (sock, m) => {
      const date = new Date(m.args[0]);
      if (isNaN(date.getTime())) return m.reply('Usage: .age YYYY-MM-DD');
      const now = new Date();
      let years = now.getFullYear() - date.getFullYear();
      const monthDiff = now.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) years--;
      await m.reply(`🎂 You are ${years} years old.`);
    },
  },
  {
    name: 'namegen',
    category: 'fun',
    desc: 'Generate a random fantasy username',
    run: async (sock, m) => {
      const adjectives = ['Shadow', 'Crimson', 'Silent', 'Golden', 'Iron', 'Mystic', 'Rogue', 'Frost', 'Blazing', 'Lunar'];
      const nouns = ['Wolf', 'Falcon', 'Ghost', 'Ronin', 'Phoenix', 'Viper', 'Titan', 'Nomad', 'Reaper', 'Storm'];
      const name = adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + Math.floor(Math.random() * 900 + 100);
      await m.reply(`🎮 ${name}`);
    },
  },
];
