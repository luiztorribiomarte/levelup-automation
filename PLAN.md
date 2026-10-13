# Build plan — personal ManyChat alternative

## Phase 1 (built, in this repo): comment keyword → auto-DM
- Webhook verify + event receiver (Express)
- Keyword matching from `triggers.json`
- Private-reply DM via Graph API (no 24h window needed)
- In-memory dedupe against webhook retries
- Render free-tier deploy config

## Phase 2: DM keyword handling + sequences
- Subscribe to the `messages` webhook field
- Keyword matching inside DMs (e.g. someone DMs "app" unprompted)
- Multi-step sequences: reply → wait → follow-up (needs a small store; SQLite first)

## Phase 3: broadcasts + tags
- Tag contacts by trigger/behavior (SQLite/Postgres)
- Manual broadcast to tagged lists (respect Meta rate limits + 24h window rules)
- Tiny dashboard to view recent automations

## Phase 4+: the long tail (only if you miss it)
- Visual flow builder, story-mention triggers, WhatsApp, analytics.
- Honest note: full ManyChat parity is months of work for a team. Phases 1–3
  cover everything the Level Up funnel actually uses.

## Notes
- `morluto/rea` (Reverse Engineer Anything) was evaluated as a possible way to
  study ManyChat's web app. Verdict: not needed — ManyChat's features are
  publicly documented and the build targets Meta's official APIs with original
  code, which keeps it clear of ManyChat's ToS (reverse-engineering their
  service to clone it would violate it).
- GitHub hosts the code; the running server lives on Render/Railway/Fly free
  tier because webhooks need an always-on HTTPS server (GitHub Pages is
  static-only and can't receive webhooks).
