const axios = require('axios');

const truths = [
  "What's a secret you've never told your family?",
  "What is your biggest fear?",
  "What's the most embarrassing thing you've done?",
  "Who was your first crush?",
  "What's a lie you've told to look cool?",
];
const dares = [
  "Send the last photo in your gallery.",
  "Text your crush 'hi' right now.",
  "Speak in an accent for the next 5 messages.",
  "Do 10 pushups and send proof.",
  "Let the group pick your WhatsApp status for a day.",
];
const facts = [
  'Honey never spoils.',
  'Octopuses have three hearts.',
  'Bananas are berries, but strawberries are not.',
  'A day on Venus is longer than its year.',
  'Wombat poop is cube-shaped.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = [
  {
    name: 'quote',
    category: 'fun',
    desc: 'Get a random inspirational quote',
    run: async (sock, m) => {
      try {
        const { data } = await axios.get('https://api.quotable.io/random');
        await m.reply(`"${data.content}"\n— ${data.author}`);
      } catch {
        await m.reply('Quote service is unavailable right now.');
      }
    },
  },
  {
    name: 'meme',
    category: 'fun',
    desc: 'Get a random meme image',
    run: async (sock, m) => {
      try {
        const { data } = await axios.get('https://meme-api.com/gimme');
        await sock.sendMessage(m.from, { image: { url: data.url }, caption: data.title }, { quoted: m.raw });
      } catch {
        await m.reply('Could not fetch a meme right now.');
      }
    },
  },
  {
    name: 'joke',
    category: 'fun',
    desc: 'Get a random joke',
    run: async (sock, m) => {
      try {
        const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke');
        await m.reply(`${data.setup}\n${data.punchline}`);
      } catch {
        await m.reply('Could not fetch a joke right now.');
      }
    },
  },
  {
    name: 'fact',
    category: 'fun',
    desc: 'Get a random fun fact',
    run: async (sock, m) => m.reply(`💡 ${pick(facts)}`),
  },
  {
    name: 'truth',
    category: 'fun',
    desc: 'Get a random truth question',
    run: async (sock, m) => m.reply(`🧠 Truth: ${pick(truths)}`),
  },
  {
    name: 'dare',
    category: 'fun',
    desc: 'Get a random dare',
    run: async (sock, m) => m.reply(`🔥 Dare: ${pick(dares)}`),
  },
  {
    name: 'ship',
    category: 'fun',
    desc: 'Ship two tagged users: .ship @a @b',
    run: async (sock, m) => {
      if (m.mentioned.length < 2) return m.reply('Tag two people: .ship @user1 @user2');
      const pct = Math.floor(Math.random() * 101);
      await sock.sendMessage(m.from, { text: `💘 Compatibility: ${pct}%`, mentions: m.mentioned });
    },
  },
  {
    name: 'rate',
    category: 'fun',
    desc: 'Rate anything out of 10: .rate pineapple pizza',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .rate <anything>');
      await m.reply(`I rate "${m.text}" a solid ${Math.floor(Math.random() * 11)}/10.`);
    },
  },
];
