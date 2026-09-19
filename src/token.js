/* ===========================================================================
   The token, read in exactly one place.

   Target shape, once this lives on contextful.com:   /invite/<token>
   Shape while it lives outside the site:             ?t=<token>

   Both are handled here so moving to the real route is a one-line change and
   nothing else in the repo has to know. The token is opaque and it is the ONLY
   thing the URL ever carries — no name, no email, no company. That rule is why
   /apply/ strips it too, and it is deliberate.
   =========================================================================== */

window.InviteToken = (function () {

  function read() {
    var url = new URL(window.location.href);

    // 1. /invite/<token> — the route we are aiming at.
    var m = url.pathname.match(/\/invite\/([^/?#]+)/);
    if (m && m[1]) return decodeURIComponent(m[1]);

    // 2. ?t=<token> — while the page is served from anywhere else.
    //    `invite` is accepted as an alias so a link copied from /apply/ works.
    return url.searchParams.get('t') || url.searchParams.get('invite') || null;
  }

  /* Take the token out of the address bar without reloading. Someone who
     forwards the URL from their browser then forwards a bare page, not a seat.
     It cannot help with a forwarded email — see the privacy note in README. */
  function scrub() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has('t') && !url.searchParams.has('invite')) return;
      url.searchParams.delete('t');
      url.searchParams.delete('invite');
      var clean = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams : '') + url.hash;
      window.history.replaceState({}, document.title, clean);
    } catch (e) { /* an old browser keeps the query string; nothing else breaks */ }
  }

  return { read: read, scrub: scrub };
})();
