// Level Up Automation — Instagram comment-keyword -> auto-DM, with a
// ManyChat-style dashboard for creating/editing automations in the browser.
//
// Flow: someone comments a keyword (e.g. "app") on your post ->
// Meta fires a webhook -> we match an enabled automation -> we send a
// private reply DM via the Graph API. Same mechanism ManyChat uses.
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendPrivateReply, sendDM } = require('./meta');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const PORT = process.env.PORT || 3000;

const TRIGGERS_PATH = path.join(__dirname, '..', 'triggers.json');

// ---------- Automations store (persisted to triggers.json) ----------
const TRIGGERS = ['comment', 'story_reply', 'dm'];

function cleanLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => l && l.url)
    .slice(0, 5)
    .map((l) => ({
      label: String(l.label || 'Link').slice(0, 40),
      url: String(l.url).slice(0, 500),
    }));
}

function migrate(raw) {
  // Old format: { keyword, reply } -> new automation object.
  return {
    id: raw.id || crypto.randomUUID(),
    name: raw.name || `Comment "${raw.keyword}" → DM`,
    platform: raw.platform || 'instagram',
    trigger: TRIGGERS.includes(raw.trigger) ? raw.trigger : 'comment',
    keyword: raw.keyword || '',
    match: raw.match || 'contains', // contains | exact | starts
    reply: raw.reply || '',
    links: cleanLinks(raw.links),
    mediaId: raw.mediaId || '', // comment trigger only: limit to one post (empty = all posts)
    enabled: raw.enabled !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

// The DM text a person receives: the message plus any labeled links.
function composeMessage(a) {
  let out = a.reply || '';
  for (const l of a.links || []) {
    out += `\n\n${l.label}: ${l.url}`;
  }
  return out.trim();
}

function loadAutomations() {
  try {
    const data = JSON.parse(fs.readFileSync(TRIGGERS_PATH, 'utf8'));
    return (Array.isArray(data) ? data : []).map(migrate);
  } catch {
    return [];
  }
}

let automations = loadAutomations();

function saveAutomations() {
  try {
    fs.writeFileSync(TRIGGERS_PATH, JSON.stringify(automations, null, 2));
  } catch (e) {
    console.error('could not persist triggers.json:', e.message);
  }
}

// ---------- Activity log (in-memory, newest first) ----------
const activity = [];
function logActivity(type, detail) {
  activity.unshift({ time: new Date().toISOString(), type, detail });
  if (activity.length > 100) activity.pop();
}

// ---------- Dashboard auth (single password, cookie session) ----------
const sessions = new Set();
function sessionToken() {
  return crypto.randomBytes(24).toString('hex');
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k] = v.join('=');
  }
  return out;
}
function isAuthed(req) {
  if (!DASHBOARD_PASSWORD) return false;
  return sessions.has(parseCookies(req).dash_session);
}
function requireAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({
      error: 'Dashboard password not set yet. Add DASHBOARD_PASSWORD in Render → Environment, then refresh.',
    });
  }
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not logged in' });
  next();
}

app.post('/api/login', (req, res) => {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: 'DASHBOARD_PASSWORD is not set on the server yet.' });
  }
  if ((req.body && req.body.password) === DASHBOARD_PASSWORD) {
    const t = sessionToken();
    sessions.add(t);
    res.setHeader('Set-Cookie', `dash_session=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(parseCookies(req).dash_session);
  res.setHeader('Set-Cookie', 'dash_session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- Automations API ----------
app.get('/api/automations', requireAuth, (_req, res) => res.json(automations));

app.post('/api/automations', requireAuth, (req, res) => {
  const b = req.body || {};
  const trigger = TRIGGERS.includes(b.trigger) ? b.trigger : 'comment';
  // Story-reply automations may fire on ANY story reply (keyword optional).
  if (trigger !== 'story_reply' && !b.keyword) {
    return res.status(400).json({ error: 'A keyword is required for this trigger.' });
  }
  if (!b.reply && !(Array.isArray(b.links) && b.links.length)) {
    return res.status(400).json({ error: 'Add a DM message or at least one link.' });
  }
  const a = migrate({
    name: String(b.name || '').slice(0, 80),
    platform: ['instagram', 'facebook', 'threads'].includes(b.platform) ? b.platform : 'instagram',
    trigger,
    keyword: String(b.keyword || '').trim().slice(0, 60),
    match: ['contains', 'exact', 'starts'].includes(b.match) ? b.match : 'contains',
    reply: String(b.reply || '').slice(0, 1000),
    links: b.links,
    mediaId: String(b.mediaId || '').trim().slice(0, 60),
    enabled: b.enabled !== false,
  });
  automations.push(a);
  saveAutomations();
  logActivity('automation_created', `${a.trigger} "${a.keyword}" → DM (${a.platform})`);
  res.status(201).json(a);
});

app.put('/api/automations/:id', requireAuth, (req, res) => {
  const a = automations.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Automation not found' });
  const b = req.body || {};
  if (b.name !== undefined) a.name = String(b.name).slice(0, 80);
  if (b.trigger !== undefined && TRIGGERS.includes(b.trigger)) a.trigger = b.trigger;
  if (b.keyword !== undefined) a.keyword = String(b.keyword).trim().slice(0, 60);
  if (b.match !== undefined && ['contains', 'exact', 'starts'].includes(b.match)) a.match = b.match;
  if (b.reply !== undefined) a.reply = String(b.reply).slice(0, 1000);
  if (b.links !== undefined) a.links = cleanLinks(b.links);
  if (b.mediaId !== undefined) a.mediaId = String(b.mediaId).trim().slice(0, 60);
  if (b.enabled !== undefined) a.enabled = !!b.enabled;
  saveAutomations();
  logActivity('automation_updated', `"${a.keyword}" (enabled: ${a.enabled})`);
  res.json(a);
});

app.delete('/api/automations/:id', requireAuth, (req, res) => {
  const i = automations.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Automation not found' });
  const [gone] = automations.splice(i, 1);
  saveAutomations();
  logActivity('automation_deleted', `"${gone.keyword}"`);
  res.json({ ok: true });
});

app.get('/api/activity', requireAuth, (_req, res) => res.json(activity));

app.get('/api/status', requireAuth, (_req, res) => {
  res.json({
    ok: true,
    automations: automations.length,
    active: automations.filter((a) => a.enabled).length,
    dmsSent: activity.filter((x) => x.type === 'dm_sent').length,
  });
});

// ---------- Dashboard page ----------
app.get('/', (_req, res) => res.redirect('/dashboard'));
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- Webhook (Meta) ----------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function matches(a, text) {
  const t = (text || '').trim().toLowerCase();
  const k = a.keyword.trim().toLowerCase();
  if (!k) return false;
  if (a.match === 'exact') return t === k;
  if (a.match === 'starts') return t.startsWith(k);
  return t.includes(k);
}

// In-memory dedupe so Meta's webhook retries never double-DM someone.
const seen = new Set();

app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  console.log('webhook POST received:', JSON.stringify(req.body).slice(0, 2000));
  handleEvent(req.body).catch((e) => console.error('webhook error:', e.message));
});

async function handleEvent(body) {
  if (!body || body.object !== 'instagram') return;
  for (const entry of body.entry || []) {
    // --- Comment events (entry.changes) ---
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (change.field === 'comments' && value.id && value.text) {
        if (seen.has(value.id)) continue;
        seen.add(value.id);
        logActivity('comment', `"${String(value.text).slice(0, 80)}"`);
        const hit = automations.find(
          (a) =>
            a.enabled &&
            a.platform === 'instagram' &&
            a.trigger === 'comment' &&
            (!a.mediaId || a.mediaId === value.media_id || a.mediaId === (value.media && value.media.id)) &&
            matches(a, value.text)
        );
        if (hit) {
          await sendPrivateReply(value.id, composeMessage(hit));
          console.log(`DM sent for comment ${value.id} (keyword: "${hit.keyword}")`);
          logActivity('dm_sent', `Comment trigger "${hit.keyword}" on comment ${value.id}`);
        }
      }
    }

    // --- Messaging events: DMs + story replies (entry.messaging) ---
    for (const ev of entry.messaging || []) {
      const msg = ev.message || {};
      if (msg.is_echo) continue;
      const mid = msg.mid || `${ev.sender && ev.sender.id}-${ev.timestamp}`;
      if (seen.has(mid)) continue;
      seen.add(mid);
      const text = msg.text || '';
      const senderId = ev.sender && ev.sender.id;
      if (!senderId) continue;

      const isStoryReply =
        !!(msg.reply_to && msg.reply_to.story) ||
        (Array.isArray(msg.attachments) && msg.attachments.some((x) => x.type === 'story_mention'));

      if (isStoryReply) {
        logActivity('story_reply', `from ${senderId}: "${String(text).slice(0, 60)}"`);
        const hit = automations.find(
          (a) =>
            a.enabled &&
            a.platform === 'instagram' &&
            a.trigger === 'story_reply' &&
            (!a.keyword || matches(a, text))
        );
        if (hit) {
          await sendDM(senderId, composeMessage(hit));
          console.log(`DM sent for story reply from ${senderId} (keyword: "${hit.keyword}")`);
          logActivity('dm_sent', `Story-reply trigger "${hit.keyword || '(any)'}" to ${senderId}`);
        }
      } else if (text) {
        logActivity('dm', `from ${senderId}: "${String(text).slice(0, 60)}"`);
        const hit = automations.find(
          (a) => a.enabled && a.platform === 'instagram' && a.trigger === 'dm' && matches(a, text)
        );
        if (hit) {
          await sendDM(senderId, composeMessage(hit));
          console.log(`DM sent for DM keyword from ${senderId} (keyword: "${hit.keyword}")`);
          logActivity('dm_sent', `DM trigger "${hit.keyword}" to ${senderId}`);
        }
      }
    }
  }
}

app.listen(PORT, () => console.log(`levelup-automation listening on :${PORT}`));
