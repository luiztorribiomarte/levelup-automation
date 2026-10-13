# Build plan — personal ManyChat alternative

## Phase 1 (built, in this repo): comment keyword → auto-DM
- Webhook verify + event receiver (Express)
- Keyword matching from `triggers.json`
- Private-reply DM via Graph API (no 24h window needed)
- In-memory dedupe against webhook retries
- Render free-tier deploy config

## Phase 1b (next): public reply + DM combo — the growth loop
- Same comment webhook event, one extra API call: post a PUBLIC reply to the
  comment in addition to the DM ("Sent you the link — check your DMs").
- Why first: every public reply = more engagement on the post = more reach =
  more keyword comments = more DMs. This is the viral loop that makes
  comment funnels scale. Smallest code change, biggest growth leverage.

## Phase 2: story mentions + DM keyword auto-replies
- Subscribe to the `story_insights`/mentions webhook field: someone mentions
  @projectlevelup1 in their story → auto-DM them the link.
- Subscribe to the `messages` field: someone DMs "app" unprompted → instant
  reply with the link.

## Phase 3: follow-up sequences + tags + broadcasts
- They got the DM but didn't convert → one nudge later (Meta's 24h messaging
  window; needs a small store — SQLite first, Postgres later).
- Tag contacts by trigger/behavior; manual broadcasts to tagged lists
  (respect rate limits + window rules).
- Tiny dashboard to view recent automations.

## Phase 4: Facebook Page support
- Same triggers (comments, DMs) on the linked Facebook Page via the Messenger
  Platform. Second audience, same codebase, no extra hosting cost.

## Out of scope (platform limits, not build limits)
- Threads: API covers posting only — Meta never opened DM automation there.
- X: API starts at $100/mo — breaks the $0 rule; account suspended anyway.
- Auto-DM on follow: impossible everywhere — Meta provides no follower webhook
  and bans unsolicited DMs. Nobody (ManyChat included) can do this.

## Notes
- `morluto/rea` (Reverse Engineer Anything) was evaluated as a possible way to
  study ManyChat's web app. Verdict: not needed — ManyChat's features are
  publicly documented and the build targets Meta's official APIs with original
  code, which keeps it clear of ManyChat's ToS (reverse-engineering their
  service to clone it would violate it).
- GitHub hosts the code; the running server lives on Render's free tier
  because webhooks need an always-on HTTPS server (GitHub Pages is static-only
  and can't receive webhooks). $0 constraint: Render free naps after ~15 min
  idle — Meta retries webhooks so DMs still go out, possibly delayed on first
  touch after idle. Oracle Cloud always-free VM is the no-sleep fallback.
