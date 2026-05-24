const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

// ---------- Rate limiting store ----------
const ipDebateCount = {};   // { ip: { count, date } }
const ipLastRequest = {};   // { ip: timestamp }

const MAX_DEBATES_PER_DAY = 50;
const MIN_SECONDS_BETWEEN = 1;

function getToday() {
  return new Date().toISOString().slice(0, 10); // "2026-05-23"
}

function checkLimits(ip) {
  const today = getToday();
  const now = Date.now();

  // Reset count if it's a new day
  if (!ipDebateCount[ip] || ipDebateCount[ip].date !== today) {
    ipDebateCount[ip] = { count: 0, date: today };
  }

  // Check daily limit
  if (ipDebateCount[ip].count >= MAX_DEBATES_PER_DAY) {
    return { allowed: false, reason: `Daily limit reached. You get ${MAX_DEBATES_PER_DAY} debates per day. Come back tomorrow.` };
  }

  // Check cooldown between requests
  if (ipLastRequest[ip] && (now - ipLastRequest[ip]) < MIN_SECONDS_BETWEEN * 1000) {
    const wait = Math.ceil((MIN_SECONDS_BETWEEN * 1000 - (now - ipLastRequest[ip])) / 1000);
    return { allowed: false, reason: `Slow down. Wait ${wait} more seconds.` };
  }

  return { allowed: true };
}

// ---------- Main proxy route ----------
app.post('/api/chat', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const check = checkLimits(ip);
  if (!check.allowed) {
    return res.status(429).json({ error: check.reason });
  }

  // Update tracking
  ipLastRequest[ip] = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    // Only count as a used debate when judge responds (last call)
    // We detect this by checking if system prompt contains "Judge"
    if (req.body.system && req.body.system.includes('judge')) {
      ipDebateCount[ip].count++;
      console.log(`IP ${ip} used debate ${ipDebateCount[ip].count}/${MAX_DEBATES_PER_DAY} today`);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong: ' + err.message });
  }
});

// ---------- Status route (optional, shows your usage) ----------
app.get('/status', (req, res) => {
  const today = getToday();
  const stats = Object.entries(ipDebateCount)
    .filter(([ip, data]) => data.date === today)
    .map(([ip, data]) => ({ ip: ip.slice(-6), debates: data.count })); // partial IP for privacy
  res.json({ date: today, activeUsers: stats.length, stats });
});

app.listen(3001, () => console.log('Proxy running on port 3001'));
