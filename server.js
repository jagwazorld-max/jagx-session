const express = require('express');
const path = require('path');
const { startNewConnection, resumeAll } = require('./lib/hostedPairing');
const botManager = require('./lib/botManager');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/pair', async (req, res) => {
  const mode = req.body && req.body.mode === 'pairing' ? 'pairing' : 'qr';
  const phone = ((req.body && req.body.phone) || '').replace(/[^0-9]/g, '');

  if (mode === 'pairing' && (!phone || phone.length < 8)) {
    res.status(400).json({ error: 'Enter a valid phone number with country code, digits only.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache, no-transform',
  });

  try {
    await startNewConnection(
      { phone, mode },
      (evt) => {
        try {
          res.write(JSON.stringify(evt) + '\n');
        } catch (e) {
          console.error('[PAIR] write failed:', e.message);
        }
      },
      170000
    );
  } catch (e) {
    console.error('[PAIR] startNewConnection threw:', e);
    try {
      res.write(JSON.stringify({ type: 'error', message: 'Server error: ' + e.message }) + '\n');
    } catch {
      // response may already be unusable
    }
  }

  res.end();
});

// Lightweight status endpoint - handy for checking how many bots are live.
app.get('/api/status', (req, res) => {
  res.json({ running: botManager.list().length, bots: botManager.list() });
});

// Disconnects a specific account and logs it out of WhatsApp entirely.
app.post('/api/logout', async (req, res) => {
  const ownerNumber = ((req.body && req.body.ownerNumber) || '').replace(/[^0-9]/g, '');
  if (!ownerNumber) return res.status(400).json({ error: 'ownerNumber required' });
  const ok = await botManager.logout(ownerNumber);
  res.json({ success: ok });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JagX session server listening on port ${PORT}`);
  resumeAll();
});
