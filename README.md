# Level Up Automation

Self-hosted Instagram DM automation for the Level Up brand — a personal,
non-commercial alternative to ManyChat. Phase 1 covers the one automation
that actually drives the funnel: **comment keyword → auto-DM**.

How it works: someone comments `app` on your post → Meta fires a webhook →
this server matches the keyword → it sends them a DM with your link via
Meta's Private Replies API. Same mechanism ManyChat uses, no middleman.

## What you need to do (your accounts, your identity)

1. **Meta Developer app** — create an app at developers.facebook.com, add the
   Instagram product, and connect your Instagram business account
   (@projectlevelup1) via its linked Facebook Page.
2. **Webhook** — in the app dashboard, subscribe to the `instagram` object,
   fields `comments` (and later `messages`). Callback URL is your deployed
   server + `/webhook`; verify token = the `WEBHOOK_VERIFY_TOKEN` you invent
   in `.env`.
3. **Token** — generate a Page access token with `instagram_manage_comments`
   (Phase 1). Put it in `.env` as `PAGE_ACCESS_TOKEN`. Never commit it.
4. **App review** — Meta requires review of those permissions before the app
   works for anyone beyond test users. This is the slowest step; start it early.
5. **Deploy** — connect this repo to Render (free tier reads `render.yaml`),
   set the two env vars in Render's dashboard, deploy. Your webhook callback
   URL becomes `https://<your-service>.onrender.com/webhook`.
6. **Test** — comment `app` on one of your posts from another account and
   check the DM lands. Watch the server logs.

## Run locally

```
npm install
cp .env.example .env   # fill in your values
npm start
```

## Change keywords / replies

Edit `triggers.json` — one entry per keyword:

```json
[
  { "keyword": "app", "reply": "Your message with the link here" }
]
```

Redeploy after editing (or restart the server locally).

## Project layout

- `src/index.js` — webhook server, keyword matching, dedupe
- `src/meta.js` — Graph API calls (private replies, DMs)
- `triggers.json` — keyword → reply config
- `render.yaml` — one-click Render deploy config
