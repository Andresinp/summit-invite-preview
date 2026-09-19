/* ===========================================================================
   The beacon. Six signals are wanted; this writes two of them.

     Sent At        — the sender writes it      (ops/send_batch.py)
     Viewed At      — derived from the first `viewed` event
     Views          — derived by counting `viewed` events
     Apply Opened At— derived from the first `apply_opened` event
     Applied At     — Airtable already writes it
     Confirmed At   — Airtable already writes it

   Two rules, both absolute:

   1. IT NEVER BLOCKS THE RENDER. Fire and forget, inside a try/catch. If the
      Web App is down, slow, or was never deployed, the guest sees exactly the
      same page. A tracking failure must never cost us an invitation.
   2. ONLY THE TOKEN GOES OVER THE WIRE. No name, no email, no IP, no
      user-agent. The sheet already knows who the token belongs to.

   Content-Type is text/plain on purpose: it keeps the request "simple", so the
   browser sends no CORS preflight. Apps Script does not answer OPTIONS, and a
   preflight would silently drop every event.
   =========================================================================== */

window.InviteTrack = (function () {

  function send(token, event) {
    var cfg = window.INVITE_CONFIG || {};
    if (!cfg.TRACKING || !cfg.WEB_APP_URL || !token) return;

    var payload = JSON.stringify({
      token: token,
      event: event,
      ts: new Date().toISOString(),
    });

    /* sendBeacon first. It is the one transport the browser promises to
       deliver even while the page is being torn down, which is exactly the
       case for `apply_opened`: the click navigates away the same instant.
       The Blob type is text/plain so the request stays "simple" and no
       preflight is attempted. fetch+keepalive is the fallback for a browser
       that has no sendBeacon; both are fire-and-forget. */
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(cfg.WEB_APP_URL, blob)) return;
      }
    } catch (e) { /* fall through */ }

    try {
      fetch(cfg.WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      }).catch(function () { /* swallowed on purpose */ });
    } catch (e) { /* swallowed on purpose */ }
  }

  return { send: send };
})();
