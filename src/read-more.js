/* ===========================================================================
   `read more` — the page behind the link in the email.

   It is the invitation's argument without the invitation: no addressee, no
   code, no RSVP. Three things happen here and there is no fourth:

     1. the theme is set              (dark, like contextful.com)
     2. the body is put on screen     (baked in, or fetched when it is not)
     3. the way back is offered       (only if the reader brought a token)

   WHAT DELIBERATELY DOES NOT HAPPEN: no guest lookup, no personalisation, no
   beacon. One URL serves everyone, so the page must be safe to forward — it
   cannot leak who was invited if it never learns who anyone is, and it cannot
   record a view by someone who was never sent it if it never sends an event.
   The Events tab would not take one anyway: ALLOWED_EVENTS in
   ops/appsscript/Code.gs has five names and none of them is this page. Adding
   one is a line there and a redeploy of the Web App, not a change here.
   =========================================================================== */

(function () {
  'use strict';

  var cfg = window.INVITE_CONFIG || {};
  var T = window.InviteStrings.get();
  var BODY = 'read-more.html';          // the fragment, under CONTENT_BASE

  /* --- 1. theme ---------------------------------------------------------- */
  /* The decision lives in config.js and is made once for every page in the
     bundle; these four lines only carry it out. Dark unless it says otherwise,
     and 'auto' follows the system the way the invitation used to. */
  function applyTheme() {
    var pinned = cfg.THEME || 'dark';
    if (pinned === 'dark' || pinned === 'light') {
      document.documentElement.setAttribute('data-theme', pinned);
      return;
    }
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var set = function () {
        document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
      };
      set();
      if (mq.addEventListener) mq.addEventListener('change', set);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  /* --- 2. the body ------------------------------------------------------- */

  function main() { return document.getElementById('brief'); }

  function loadBody() {
    return fetch((cfg.CONTENT_BASE || 'content/build/') + BODY, { cache: 'default' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (htmlText) {
        var holder = document.createElement('div');
        holder.innerHTML = htmlText;
        var sheet = holder.querySelector('.sheet');
        if (!sheet) throw new Error('no .sheet in ' + BODY);
        main().textContent = '';
        main().appendChild(sheet);
      });
  }

  /* --- 3. the way back --------------------------------------------------- */

  /* A reader who arrived from their own invitation keeps a way back to it, and
     the token goes no further than the link: it is read, taken out of the
     address bar, and written into one href. A reader without one — anyone the
     link was forwarded to — is offered nothing, because there is nothing that
     belongs to them to offer. */
  function offerTheWayBack(token) {
    if (!token) return;

    var box = document.createElement('section');
    box.className = 'confirm';

    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = T.briefLabel;
    box.appendChild(label);

    var a = document.createElement('a');
    a.className = 'btn';
    a.href = './?t=' + encodeURIComponent(token);   // index.html, beside this one
    a.textContent = T.briefCta;
    box.appendChild(a);

    main().appendChild(box);
  }

  function boot() {
    applyTheme();

    var dateline = document.querySelector('.dateline');
    if (dateline) dateline.textContent = T.dateline;

    var token = window.InviteToken.read();
    window.InviteToken.scrub();

    var ready = main().querySelector('.sheet')
      ? Promise.resolve()                     // baked in by ops/make_deploy.py
      : loadBody();

    ready.then(function () { offerTheWayBack(token); })
         .catch(function (err) {
           if (window.console) console.warn('[read-more] body unavailable:', err);
         });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
