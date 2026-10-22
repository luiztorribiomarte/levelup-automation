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

// Plain DM to an Instagram-scoped user id (needs the 24h window / prior contact).
// An inbound DM or story reply opens that window, which is what the
// DM-keyword and story-reply automations rely on.
async function sendDM(igScopedUserId, message) {
  return graph(`me/messages`, {
    recipient: JSON.stringify({ id: igScopedUserId }),
    message: JSON.stringify({ text: message }),
  });
}

module.exports = { sendPrivateReply, sendDM };
