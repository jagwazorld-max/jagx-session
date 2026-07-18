const axios = require('axios');

module.exports = [
  {
    name: 'wiki',
    category: 'info',
    desc: 'Search Wikipedia: .wiki Albert Einstein',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .wiki <topic>');
      try {
        const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(m.text)}`);
        await m.reply(`*${data.title}*\n\n${data.extract}`);
      } catch {
        await m.reply('No Wikipedia article found for that.');
      }
    },
  },
  {
    name: 'define',
    alias: ['dictionary'],
    category: 'info',
    desc: 'Get the definition of a word: .define ephemeral',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .define <word>');
      try {
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(m.text)}`);
        const entry = data[0];
        const meaning = entry.meanings[0];
        await m.reply(`*${entry.word}* (${meaning.partOfSpeech})\n${meaning.definitions[0].definition}`);
      } catch {
        await m.reply('No definition found for that word.');
      }
    },
  },
  {
    name: 'weather',
    category: 'info',
    desc: 'Get current weather: .weather Lagos',
    run: async (sock, m, args, ctx) => {
      if (!ctx.config.OPENWEATHER_KEY) return m.reply('Weather needs an OPENWEATHER_KEY set in .env — get a free one at openweathermap.org.');
      if (!m.text) return m.reply('Usage: .weather <city>');
      try {
        const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { q: m.text, appid: ctx.config.OPENWEATHER_KEY, units: 'metric' },
        });
        await m.reply(`📍 ${data.name}\n🌡 ${data.main.temp}°C (feels ${data.main.feels_like}°C)\n☁ ${data.weather[0].description}\n💧 Humidity: ${data.main.humidity}%`);
      } catch {
        await m.reply('Could not find weather for that location.');
      }
    },
  },
  {
    name: 'lyrics',
    category: 'info',
    desc: 'Find song lyrics: .lyrics <song name>',
    run: async (sock, m) => {
      if (!m.text) return m.reply('Usage: .lyrics <song title / artist>');
      try {
        const [artist, ...songParts] = m.text.split('-');
        const song = songParts.join('-').trim() || m.text;
        const { data } = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist.trim())}/${encodeURIComponent(song)}`);
        await m.reply(data.lyrics.slice(0, 3500));
      } catch {
        await m.reply('Try the format: .lyrics Artist - Song Title');
      }
    },
  },
  {
    name: 'ai',
    alias: ['gpt', 'ask'],
    category: 'info',
    desc: 'Chat with an AI: .ai <question>',
    run: async (sock, m, args, ctx) => {
      if (!ctx.config.ANTHROPIC_API_KEY) return m.reply('AI chat needs ANTHROPIC_API_KEY set in .env (get one at console.anthropic.com).');
      if (!m.text) return m.reply('Usage: .ai <your question>');
      try {
        const { data } = await axios.post(
          'https://api.anthropic.com/v1/messages',
          { model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: m.text }] },
          { headers: { 'x-api-key': ctx.config.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
        );
        const text = data.content.map((c) => c.text || '').join('\n');
        await m.reply(text || 'No response.');
      } catch (e) {
        await m.reply('AI request failed: ' + (e.response?.data?.error?.message || e.message));
      }
    },
  },
];
