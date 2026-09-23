/* ===========================================================================
   Every string the page shows that is not in the markdown.

   The body of the invitation is English, because content/*.md is English, so
   `en` is the default and the two must not disagree on one page. The Spanish
   set is here verbatim from the build brief and is one config line away
   (`LOCALE: 'es'`). Nothing outside this file holds display text.

   Voice, per design-system/README.md §6: sentence case, short declarative
   sentences, second person. No exclamation marks, no emoji.
   =========================================================================== */

window.InviteStrings = (function () {

  var S = {
    en: {
      /* The invitation's own sentence. {name} is always the FIRST name: it is a
         greeting, and "Mockname Mocksurname Uno, Sebastian thought…" is not one.
         `vouchedAlone` is not a lesser version — it is what a guest with no
         connector on their row gets, and it has to stand on its own. */
      greeting:     'Hi {name},',
      vouched:      '{connector} thought you should be in the room.',
      preparedFor:  'Prepared for',
      putForwardBy: 'Put forward by',
      codeLabel:    'Your invite code',
      companions:   'Yours, and you can share it with up to {n} more people.',
      confirmCta:   'Confirm my attendance',
      confirmNote:  'It takes a minute. Your details are already filled in.',
      genericCta:   'Apply for a seat',
      briefLabel:   'Your invitation',
      briefCta:     'See your full invitation',
      genericNote:  'We answer every application within 24 hours.',
      confirmedLabel:    'Confirmed',
      confirmedHeadline: 'Your place is confirmed.',
      confirmedShare:    'Your code stays open. Pass it to the people you want in the room.',
      dtDates:      'Dates',
      ddDates:      'October 5–6, 2026. Arrive October 4, leave October 7.',
      dtVenue:      'Venue',
      ddVenue:      'Presidio Golf Course, San Francisco. The launch party is on the USS Hornet, Alameda.',
      dtTransport:  'Transport',
      ddTransport:  'Provided between venues on both days.',
      dtContact:    'Anything else',
      ddContact:    'info@contextful.com',
      dateline:     'October 5–6, 2026 · San Francisco',
      footNote:     'Private invitation. Not for circulation.',
    },
    es: {
      greeting:     'Hola {name},',
      vouched:      '{connector} cree que deberías estar en esa sala.',
      preparedFor:  'Preparada para',
      putForwardBy: 'Propuesto por',
      codeLabel:    'Tu código de invitación',
      companions:   'Es tuyo, y puedes compartirlo con hasta {n} personas más.',
      confirmCta:   'Confirmar mi asistencia',
      confirmNote:  'Toma un minuto. Tus datos ya van cargados.',
      genericCta:   'Solicitar un asiento',
      briefLabel:   'Tu invitación',
      briefCta:     'Ver tu invitación completa',
      genericNote:  'Respondemos cada solicitud en 24 horas.',
      confirmedLabel:    'Confirmado',
      confirmedHeadline: 'Tu lugar está confirmado.',
      confirmedShare:    'Tu código sigue abierto. Pásalo a quien quieras en la sala.',
      dtDates:      'Fechas',
      ddDates:      '5 y 6 de octubre de 2026. Llegada el 4, salida el 7.',
      dtVenue:      'Sede',
      ddVenue:      'Presidio Golf Course, San Francisco. La fiesta de lanzamiento es en el USS Hornet, Alameda.',
      dtTransport:  'Transporte',
      ddTransport:  'Provisto entre sedes los dos días.',
      dtContact:    'Cualquier cosa',
      ddContact:    'info@contextful.com',
      dateline:     '5–6 de octubre de 2026 · San Francisco',
      footNote:     'Invitación privada. No circular.',
    },
  };

  function pick() {
    var loc = (window.INVITE_CONFIG || {}).LOCALE || 'en';
    return S[loc] || S.en;
  }

  return { get: pick, all: S };
})();
