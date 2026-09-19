/* ===========================================================================
   The data adapter. One function — getProfile(token) — and two ways of
   answering it. Everything reads BY FIELD NAME; nothing anywhere in this repo
   depends on a column position or has a table id buried in it.

   The field names below are the Airtable field names, spelled exactly. The
   `People` tab of the workbook uses the same spellings, which is the whole
   point: changing DATA_SOURCE changes the transport and nothing else.
   =========================================================================== */

window.InviteData = (function () {

  /* The contract. Left: what this app calls it. Right: the field name, in
     Airtable and in the `People` sheet alike. */
  var FIELD = {
    recordId:   'Record ID',
    fullName:   'Full Name',
    firstName:  'First Name',
    lastName:   'Last Name',
    email:      'Email',
    title:      'Title',
    org:        'Org',
    codeOwner:  'Code Owner',
    inviteCode: 'Invite Code',
    token:      'Invite Token',
    applyToken: 'Apply Token',
    variant:    'Variant',
    status:     'Invite Status',
    notes:      'Notes',
  };

  var NOT_FOUND = { found: false, profile: null };

  function str(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  /* A row keyed by field name -> the shape the page works with. Missing values
     become empty strings, never the word "null" and never "undefined": A.1
     drops a line it has no value for rather than printing a hole. */
  function fromRow(row) {
    var p = {};
    Object.keys(FIELD).forEach(function (k) { p[k] = str(row[FIELD[k]]); });
    if (!p.fullName) p.fullName = str(p.firstName + ' ' + p.lastName).trim();
    if (!p.firstName && p.fullName) p.firstName = p.fullName.split(/\s+/)[0];
    p.confirmed = /^confirmed$/i.test(p.status);
    return p;
  }

  function get(url) {
    return fetch(url, { method: 'GET', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* --- source: the Google Sheet, through the Apps Script Web App ---------- */

  function fromSheet(token, cfg) {
    /* ORDER MATTERS, and it is the difference between a page that feels
       instant and one that visibly waits.

       The baked guest file sits on the same CDN as the page, is a couple of
       kilobytes, and answers in the time of one cached request. The Apps
       Script Web App answers in hundreds of milliseconds on a good day, over
       a redirect, and on a phone it is the slowest thing in the whole chain.

       So the static file goes first and the page renders from it. The Web App
       is then asked in the BACKGROUND, and only one thing can come back that
       the static file could not know: that this guest has since confirmed.
       When it does, `onRevalidate` swaps the confirmation block and nothing
       else. Stale, then correct, beats correct-but-late. */
    var live = function () {
      if (!cfg.WEB_APP_URL) return Promise.resolve(NOT_FOUND);
      return get(cfg.WEB_APP_URL + (cfg.WEB_APP_URL.indexOf('?') < 0 ? '?' : '&') +
                 'token=' + encodeURIComponent(token))
        .then(function (d) {
          if (!d || d.found === false || !d.profile) return NOT_FOUND;
          return { found: true, profile: fromRow(d.profile) };
        });
    };

    var baked = function () {
      if (!cfg.GUESTS_URL) return Promise.resolve(NOT_FOUND);
      return get(cfg.GUESTS_URL).then(function (rows) {
        var hit = (rows || []).filter(function (r) {
          return str(r[FIELD.token]) === token;
        })[0];
        return hit ? { found: true, profile: fromRow(hit) } : NOT_FOUND;
      });
    };

    return baked().catch(function () { return NOT_FOUND; }).then(function (res) {
      if (res && res.found) {
        res.revalidate = live().catch(function () { return NOT_FOUND; });
        return res;
      }
      return live().catch(function () { return NOT_FOUND; });
    });
  }

  /* --- source: Airtable, through the endpoints that already exist ---------
     POST /api/summit-invite/prefill  { inviteToken } ->
       { found: true, profile: { firstName, lastName, email, company, title,
                                 inviteCode } }

     ⚠ That response carries neither `Code Owner`, nor `Variant`, nor
     `Invite Status`. Until the endpoint returns them, this adapter degrades
     the way A.1 and A.4 are specified to degrade: no connector line, the
     configured variant, and not-yet-confirmed. Both spellings are read, so
     the day the API adds them nothing here has to change.                   */

  function fromAirtable(token, cfg) {
    return fetch(cfg.API_BASE + '/api/summit-invite/prefill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken: token }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || d.found === false || !d.profile) return NOT_FOUND;
      var a = d.profile;
      var row = {};
      row[FIELD.firstName]  = a.firstName;
      row[FIELD.lastName]   = a.lastName;
      row[FIELD.email]      = a.email;
      row[FIELD.title]      = a.title;
      row[FIELD.org]        = a.company;            // `company` on the wire, `Org` in the base
      row[FIELD.inviteCode] = a.inviteCode;
      row[FIELD.token]      = token;
      row[FIELD.codeOwner]  = a.codeOwner  || a[FIELD.codeOwner] || '';
      row[FIELD.variant]    = a.variant    || a[FIELD.variant]   || '';
      row[FIELD.status]     = a.inviteStatus || a.ticketStatus || a[FIELD.status] || '';
      return { found: true, profile: fromRow(row) };
    });
  }

  /* Try each source in turn; a thrown error or a miss falls through to the
     next. When they are all exhausted the page goes generic (A.5) — never a
     404, never an error message in a guest's face. */
  function chain(tries) {
    var i = 0;
    function step() {
      if (i >= tries.length) return Promise.resolve(NOT_FOUND);
      return tries[i++]().then(function (res) {
        return (res && res.found) ? res : step();
      }, step);
    }
    return step();
  }

  function getProfile(token) {
    var cfg = window.INVITE_CONFIG || {};
    if (!token) return Promise.resolve(NOT_FOUND);
    var source = cfg.DATA_SOURCE === 'airtable'
      ? function () { return fromAirtable(token, cfg); }
      : function () { return fromSheet(token, cfg); };
    return chain([source]);
  }

  return { getProfile: getProfile, FIELD: FIELD };
})();
