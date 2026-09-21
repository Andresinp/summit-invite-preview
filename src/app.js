/* ===========================================================================
   The landing. Four things happen here, in this order:

     1. the theme is set              (the kit's own dark palette, nothing new)
     2. the token is read and scrubbed from the URL
     3. the sheet body is fetched and personalised
     4. the confirmation block is built — A.3, or A.4 if they are already in

   There is exactly one failure mode and it is the generic page: no token, an
   unknown token, a source that is down. A guest never sees a 404 and never
   sees an error. See README.md, "What can go wrong".
   =========================================================================== */

(function () {
  'use strict';

  var cfg = window.INVITE_CONFIG || {};
  var T = window.InviteStrings.get();
  var VARIANTS = ['line-up', 'room', 'line-up-short'];

  /* --- 1. theme ---------------------------------------------------------- */
  /* The kit ships a complete dark palette under [data-theme="dark"]. Rather
     than restate any of it — which would mean writing colours — we just set
     the attribute when the system asks for dark. Light is the default. */
  function applyTheme() {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var set = function () {
        document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
      };
      set();
      if (mq.addEventListener) mq.addEventListener('change', set);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  /* --- helpers ----------------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function applyLink(token, profile) {
    /* The form is production and already works. We hand it a token and nothing
       else: it prefills the five fields and the code itself. The URL carries no
       name, no email, no company — that is the rule.

       Which token: the guest's own `Apply Token` when they have one, then the
       configured fallback, then ours. That order matters while `People` is a
       sheet, because our token means nothing to Airtable and the form would
       come up blank. See the note in src/data.js. */
    var t = (profile && profile.applyToken) || cfg.APPLY_FALLBACK_TOKEN || token;
    return t ? cfg.APPLY_BASE + '?invite=' + encodeURIComponent(t) : cfg.APPLY_BASE;
  }

  function variantFor(profile) {
    var v = (cfg.HONOUR_PER_GUEST_VARIANT && profile && profile.variant) || cfg.ACTIVE_VARIANT;
    return VARIANTS.indexOf(v) >= 0 ? v : 'line-up';
  }

  /* --- 3. the body ------------------------------------------------------- */

  function contentFile(variant) {
    var map = cfg.CONTENT_FILES || {};
    return map[variant] || ('the-' + variant + '.html');
  }

  /* The body is already in the document when ops/make_deploy.py baked it in,
     which is the normal case in production. Only a guest who needs the OTHER
     variant costs a request, and that only happens when the Variant column is
     being honoured. */
  function bakedSheet(variant) {
    var main = document.getElementById('invitation');
    var sheet = main && main.querySelector('.sheet');
    if (!sheet) return null;
    var baked = cfg.BAKED_VARIANT || document.body.getAttribute('data-baked-variant');
    return (!baked || baked === variant) ? sheet : null;
  }

  function loadBody(variant) {
    return fetch(cfg.CONTENT_BASE + contentFile(variant), { cache: 'default' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
  }

  /* A.1 — the personalised head.
     Built from data rather than by swapping {{TOKENS}} in place, because a
     missing value has to remove its whole line, not leave "Put forward by"
     hanging with nothing after it. No organisation means no separator either. */
  function personaliseHeader(root, profile) {
    var node = root.querySelector('.addressee');
    if (!node) return;

    if (!profile) { node.remove(); return; }           // generic page: no line at all

    var name = cfg.HEADER_NAME === 'first'
      ? (profile.firstName || profile.fullName)
      : (profile.fullName || profile.firstName);

    var lines = [];

    if (name) {
      var l1 = el('span');
      l1.appendChild(document.createTextNode(T.preparedFor + ' '));
      l1.appendChild(el('strong', null, name));
      if (profile.org) l1.appendChild(document.createTextNode(' · ' + profile.org));
      lines.push(l1);
    }

    if (profile.codeOwner) {
      var l2 = el('span');
      l2.appendChild(document.createTextNode(T.putForwardBy + ' '));
      l2.appendChild(el('strong', null, profile.codeOwner));
      lines.push(l2);
    }

    if (!lines.length) { node.remove(); return; }

    node.textContent = '';
    lines.forEach(function (l, i) {
      if (i) node.appendChild(document.createElement('br'));
      node.appendChild(l);
    });
    node.classList.add('is-ready');       // it holds a name now; let it show
  }

  /* The sheet carries its own claim block, which is the placeholder this whole
     page replaces. It comes out: one code on the page, one button on the page. */
  function dropSheetClaim(root) {
    var claim = root.querySelector('.claim');
    if (claim) claim.remove();
  }

  /* --- 4. the confirmation block ----------------------------------------- */

  function buildConfirm(profile, token) {
    var box = el('section', 'confirm');

    /* A.4 — they are already in. Ask for nothing. */
    if (profile && profile.confirmed) {
      box.className = 'confirm status';
      box.appendChild(el('span', 'label', T.confirmedLabel));
      box.appendChild(el('p', 'headline', T.confirmedHeadline));

      var dl = document.createElement('dl');
      [[T.dtDates, T.ddDates], [T.dtVenue, T.ddVenue],
       [T.dtTransport, T.ddTransport], [T.dtContact, T.ddContact]].forEach(function (pair) {
        var d = el('div');
        d.appendChild(el('dt', null, pair[0]));
        d.appendChild(el('dd', null, pair[1]));
        dl.appendChild(d);
      });
      box.appendChild(dl);

      if (profile.inviteCode) {
        var plate = el('div', 'code-plate');
        plate.appendChild(el('span', 'code', profile.inviteCode));
        plate.appendChild(el('span', 'companions', T.confirmedShare));
        box.appendChild(plate);
      }
      return box;
    }

    /* A.3 — the code, the promise, and one button. */
    box.appendChild(el('span', 'label', profile ? T.codeLabel : T.genericCta));

    if (profile && profile.inviteCode) {
      var p = el('div', 'code-plate');
      p.appendChild(el('span', 'code', profile.inviteCode));
      p.appendChild(el('span', 'companions',
        T.companions.replace('{n}', String(cfg.COMPANIONS))));
      box.appendChild(p);
    }

    var a = el('a', 'btn', profile ? T.confirmCta : T.genericCta);
    a.href = applyLink(token, profile);
    a.addEventListener('click', function () {
      window.InviteTrack.send(token, 'apply_opened');   // fire and forget
    });
    box.appendChild(a);
    box.appendChild(el('p', 'note', profile ? T.confirmNote : T.genericNote));
    return box;
  }

  /* --- wiring ------------------------------------------------------------ */

  function render(profile, token) {
    var main = document.getElementById('invitation');
    var variant = variantFor(profile);
    var already = bakedSheet(variant);

    function place(sheet) {
      personaliseHeader(sheet, profile);
      dropSheetClaim(sheet);
      if (sheet.parentNode !== main) {
        main.textContent = '';
        main.appendChild(sheet);
      }
      var confirm = buildConfirm(profile, token);
      confirm.id = 'confirm-block';
      var old = document.getElementById('confirm-block');
      if (old) old.parentNode.replaceChild(confirm, old);
      else main.appendChild(confirm);
      document.body.setAttribute('data-variant', variant);
      document.body.setAttribute('data-state',
        !profile ? 'generic' : (profile.confirmed ? 'confirmed' : 'invited'));
    }

    if (already) { place(already); return Promise.resolve(); }

    return loadBody(variant).then(function (htmlText) {
      var holder = document.createElement('div');
      holder.innerHTML = htmlText;
      var sheet = holder.querySelector('.sheet');
      if (!sheet) throw new Error('no .sheet in ' + variant + '.html');
      place(sheet);
    });
  }

  /* The only thing the Web App can tell us that the baked file could not is
     that this guest has confirmed since the deploy. When it says so, the
     confirmation block is rebuilt and nothing else on the page moves. */
  function revalidate(res, token) {
    if (!res || !res.revalidate) return;
    res.revalidate.then(function (fresh) {
      if (!fresh || !fresh.found || !fresh.profile) return;
      if (fresh.profile.confirmed === (res.profile && res.profile.confirmed)) return;
      render(fresh.profile, token);
    }).catch(function () { /* the page is already correct enough */ });
  }

  /* Only ever shown when there is nothing else to show. */
  function showFallback(token) {
    var main = document.getElementById('invitation');
    if (main.querySelector('.sheet')) return;
    main.textContent = '';
    main.appendChild(buildConfirm(null, token));
    document.body.setAttribute('data-state', 'fallback');
  }

  function boot() {
    applyTheme();

    var dateline = document.querySelector('.dateline');
    if (dateline) dateline.textContent = T.dateline;
    var footNote = document.querySelector('.foot .note');
    if (footNote) footNote.textContent = T.footNote;

    var token = window.InviteToken.read();
    window.InviteToken.scrub();

    window.InviteData.getProfile(token)
      .then(function (res) {
        var profile = res && res.found ? res.profile : null;
        /* The view is recorded once we know the token is real, and the record
           never gates the render — it is sent after the page is on screen. */
        return render(profile, token).then(function () {
          if (profile) window.InviteTrack.send(token, 'viewed');
          revalidate(res, token);
        });
      })
      .catch(function (err) {
        if (window.console) console.warn('[invite] body unavailable:', err);
        showFallback(token);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
