/* ===========================================================================
   The landing. Four things happen here, in this order:

     1. the theme is set              (the kit's own dark palette, nothing new)
     2. the token is read and scrubbed from the URL
     3. the sheet body is fetched and personalised
     4. the confirmation block is built — A.3, or A.4 if they are already in

   A sheet may also ask for the seat before the end: any standalone link to the
   apply form in the markdown becomes the same button, on the same link. Only
   the reduced variant does it today.

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
  /* The kit ships both palettes under [data-theme]. Nothing is restated here —
     which would mean writing colours — we only choose which one is on.

     The invitation is dark by default and stays dark on a phone set to light,
     because it has to look like contextful.com and not like the phone. A guest
     comparing the two has to see one brand. `THEME: 'auto'` gives back the old
     behaviour, following the system. */
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
     missing value has to remove its whole line rather than leave half a
     sentence standing. Three lines, in this order:

       <name>, <connector> thought you should be in the room.   .addressee
       You're invited to the Contextful Summit.                 .invited
       <organisation>                                           .org

     The first is the only one that knows anything about the reader, so it is
     the only one that can be wrong. Without a name there is no sentence at all
     and the element goes, which leaves the page saying only what it can still
     honestly say. */
  function personaliseHeader(root, profile) {
    var node = root.querySelector('.addressee');
    if (!node) return;

    if (!profile) { node.remove(); return; }           // generic page: no line at all

    /* Always the first name. cfg.HEADER_NAME picks how the old two-line block
       addressed someone; this is a greeting inside a sentence, and a full name
       in it reads like a summons rather than a note from a person. */
    var first = profile.firstName
      || (profile.fullName || '').trim().split(/\s+/)[0]
      || '';

    var line = '';
    if (first && profile.codeOwner) {
      line = T.vouched.replace('{name}', first).replace('{connector}', profile.codeOwner);
    } else if (first) {
      line = T.vouchedAlone.replace('{name}', first);
    }

    if (!line) { node.remove(); return; }

    node.textContent = line;
    node.classList.add('is-ready');       // it holds a name now; let it show

    /* The organisation is context, not address: it goes last and quiet. It is
       inserted rather than baked in because a row without one must not leave an
       empty line behind.

       It follows the confirmation line when there is one and the sentence
       itself when there is not. Hanging it off .invited alone silently dropped
       the organisation on every sheet that does not carry that line. */
    if (profile.org) {
      var after = root.querySelector('.invited') || node;
      after.parentNode.insertBefore(el('p', 'org', profile.org), after.nextSibling);
    }
  }

  /* The sheet carries its own claim block, which is the placeholder this whole
     page replaces. It comes out: one code on the page, one button on the page. */
  function dropSheetClaim(root) {
    var claim = root.querySelector('.claim');
    if (claim) claim.remove();
  }

  /* --- 3b. the inline asks ----------------------------------------------- */

  /* One button component, asked for more than once.

     A sheet marks a place to ask by carrying a standalone link to the apply
     form. The markdown knows nothing about buttons: every such link becomes
     the same `.btn` the confirmation block uses, on the same personalised URL,
     reporting the same event. The sheets that do not carry one are untouched.

     Two cases are the whole reason this is not a template string:
       - a guest who has already confirmed is asked for nothing, so the slots
         are removed rather than restyled;
       - render() can run twice (see revalidate), so a wired link is updated
         in place and never given a second click handler. */

  function ctaLabel(profile) { return profile ? T.confirmCta : T.genericCta; }

  function wireCta(a, profile, token) {
    a.className = 'btn';
    a.href = applyLink(token, profile);
    a.textContent = ctaLabel(profile);
    if (a.getAttribute('data-cta')) return a;          // already has its handler
    a.setAttribute('data-cta', '1');
    a.addEventListener('click', function () {
      window.InviteTrack.send(token, 'apply_opened');   // fire and forget
    });
    return a;
  }

  function inlineCtas(root, profile, token) {
    var links = root.querySelectorAll('a[href*="contextful.com/apply"]');
    if (!links.length) return;

    var confirmed = !!(profile && profile.confirmed);

    Array.prototype.forEach.call(links, function (a) {
      var p = a.parentNode;
      var alone = p && p.tagName === 'P' &&
                  p.textContent.trim() === a.textContent.trim();
      var slot = alone ? p : a;
      if (confirmed) { slot.parentNode.removeChild(slot); return; }
      if (alone) slot.className = 'cta-inline';
      wireCta(a, profile, token);
    });

    /* The first ask belongs under the vitals strip, where the reader has just
       been told what the two days are. The markdown header block ends at that
       table and cannot hold anything after it, so this one is placed here. */
    var vitals = root.querySelector('header .vitals');
    if (!vitals) return;
    var old = root.querySelector('.cta-hero');
    if (old) old.parentNode.removeChild(old);
    if (confirmed) return;
    var hero = el('p', 'cta-inline cta-hero');
    hero.appendChild(wireCta(el('a', null, ''), profile, token));
    vitals.parentNode.insertBefore(hero, vitals.nextSibling);
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
      inlineCtas(sheet, profile, token);
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
