// Level Up Automation — Phase 1: Instagram comment-keyword -> auto-DM.
//
// Flow: someone comments a keyword (e.g. "app") on your post ->
// Meta fires a webhook -> we match the keyword -> we send a private
// reply DM via the Graph API. Same mechanism ManyChat uses.
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { sendPrivateReply } = require('./meta');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

const triggers = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'triggers.json'), 'utf8')
);

// In-memory dedupe so Meta's webhook retries never double-DM someone.
// (Restarts clear it; for Phase 1 volumes that's fine.)
const seen = new Set();

function matchTrigger(text) {
  const t = (text || '').toLowerCase();
  return triggers.find((tr) => t.includes(tr.keyword.toLowerCase()));
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Meta calls this once when you subscribe the webhook. It must echo the challenge.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Meta POSTs every subscribed event here. Ack fast, work after.
app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  handleEvent(req.body).catch((e) => console.error('webhook error:', e.message));
});

async function handleEvent(body) {
  if (!body || body.object !== 'instagram') return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      // Comment trigger: "app" in a comment -> private-reply DM.
      if (change.field === 'comments' && value.id && value.text) {
        if (seen.has(value.id)) continue;
        seen.add(value.id);
        const hit = matchTrigger(value.text);
        if (hit) {
          await sendPrivateReply(value.id, hit.reply);
          console.log(`DM sent for comment ${value.id} (keyword: "${hit.keyword}")`);
        }
      }
    }
  }
}

app.listen(PORT, () => console.log(`levelup-automation listening on :${PORT}`));
