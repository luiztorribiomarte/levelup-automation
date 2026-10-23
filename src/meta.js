// Minimal wrapper around Meta's Graph API for the automation server.
const API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

async function graph(path, params) {
  const qs = new URLSearchParams({ ...params, access_token: PAGE_ACCESS_TOKEN });
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${path}?${qs}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Graph API error: ${JSON.stringify(data)}`);
  }
  return data;
}

// ManyChat's comment -> DM trick: a "private reply" to the comment.
// Works without the 24h messaging window. One DM per comment.
async function sendPrivateReply(commentId, message) {
  return graph(`${commentId}/private_replies`, { message });
}

// Public reply posted under an Instagram comment (shows in the comment thread).
async function sendCommentReply(commentId, message) {
  return graph(`${commentId}/replies`, { message });
}

// Public reply under a Facebook Page comment. Same Page token and host as
// the IG calls, but the FB endpoint is /{comment-id}/comments (IG uses
// /replies). Private replies and Messenger sends reuse the functions above:
// POST /{comment-id}/private_replies and POST /me/messages work for a Page
// with the Page access token exactly as they do for Instagram.
async function sendPageCommentReply(commentId, message) {
  return graph(`${commentId}/comments`, { message });
}

// Threads has no DMs — a public reply is the delivery. Uses the separate
// Threads user access token (env THREADS_ACCESS_TOKEN) on graph.threads.net.
const THREADS_API_VERSION = process.env.THREADS_API_VERSION || 'v1.0';
async function sendThreadsReply(replyId, text) {
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!token) throw new Error('threads token not configured');
  const qs = new URLSearchParams({ text, access_token: token });
  const res = await fetch(`https://graph.threads.net/${THREADS_API_VERSION}/${replyId}/replies?${qs}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Threads API error: ${JSON.stringify(data)}`);
  }
  return data;
}

// Plain DM to an Instagram-scoped user id (needs the 24h window / prior contact).
// An inbound DM or story reply opens that window, which is what the
// DM-keyword and story-reply automations rely on.
async function sendDM(igScopedUserId, message) {
  return graph(`me/messages`, {
    recipient: JSON.stringify({ id: igScopedUserId }),
    message: JSON.stringify({ text: message }),
  });
}

module.exports = { sendPrivateReply, sendDM, sendCommentReply, sendPageCommentReply, sendThreadsReply };
