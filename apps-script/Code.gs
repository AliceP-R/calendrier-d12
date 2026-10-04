// Google Apps Script pour Au Dé 12 - Récupère les événements avec colorId
// À copier-coller ENTIÈREMENT dans script.google.com
// Utilise l'API Calendar pour obtenir les vrais colorIds

// IDs des calendriers
const JDS_CALENDAR_ID = 'c_b182530e0a332b3e4f20ff0c2308bb5010f8c91130af1b6e6828aa6a15751a6e@group.calendar.google.com';
const JDR_CALENDAR_ID = 'gestionjdr@au-de12paris.com';

function doGet(e) {
  try {
    // Gérer le cas où e est undefined
    e = e || {};
    const callback = e.parameter ? e.parameter.callback : null;

    const events = getPublicEvents();

    if (callback) {
      // JSONP response
      var output = callback + '(' + JSON.stringify(events) + ');';
      return ContentService.createTextOutput(output)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      // Regular JSON response
      var textOutput = ContentService.createTextOutput(JSON.stringify(events));
      textOutput.setMimeType(ContentService.MimeType.JSON);
      return textOutput;
    }
  } catch (error) {
    Logger.log('Erreur doGet: ' + error);
    const errorOutput = JSON.stringify({error: error.toString()});

    var textOutput = ContentService.createTextOutput(errorOutput);
    textOutput.setMimeType(ContentService.MimeType.JSON);
    return textOutput;
  }
}

function getPublicEvents() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Date du début du mois courant et fin du mois suivant + 1
  const startDate = new Date(currentYear, currentMonth, 1);
  const endDate = new Date(currentYear, currentMonth + 2, 1);

  Logger.log('📅 Récupération des événements...');
  Logger.log('Période: ' + formatDate(startDate) + ' à ' + formatDate(endDate));

  const jdsEvents = getCalendarEventsWithAPI(JDS_CALENDAR_ID, 'jds', startDate, endDate);
  const jdrEvents = getCalendarEventsWithAPI(JDR_CALENDAR_ID, 'jdr', startDate, endDate);

  Logger.log('JDS bruts: ' + jdsEvents.length + ' événements');
  Logger.log('JDR bruts: ' + jdrEvents.length + ' événements');

  // Filtrer les événements privés
  const publicJdsEvents = jdsEvents.filter(e => {
    const vis = String(e.visibility).toLowerCase();
    return vis !== 'private' && vis !== 'confidential';
  });
  const publicJdrEvents = jdrEvents.filter(e => {
    const vis = String(e.visibility).toLowerCase();
    return vis !== 'private' && vis !== 'confidential';
  });

  Logger.log('JDS publics: ' + publicJdsEvents.length + ' événements');
  Logger.log('JDR publics: ' + publicJdrEvents.length + ' événements');

  return {
    jds: publicJdsEvents,
    jdr: publicJdrEvents,
    generated: new Date().toISOString()
  };
}

function getCalendarEventsWithAPI(calendarId, calendarType, startDate, endDate) {
  try {
    Logger.log('🔄 Tentative API Calendar pour: ' + calendarId);

    // Utiliser Calendar API pour obtenir les vrais colorIds
    // singleEvents=true étend les événements récurrents en instances individuelles
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' +
                encodeURIComponent(calendarId) + '/events?' +
                'timeMin=' + startDate.toISOString() +
                '&timeMax=' + endDate.toISOString() +
                '&maxResults=250' +
                '&showDeleted=false' +
                '&singleEvents=true';

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true,
      timeout: 30000
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('  → Code HTTP: ' + responseCode);

    if (responseCode !== 200) {
      Logger.log('  ⚠️ Erreur API Calendar: Code ' + responseCode);
      Logger.log('  Réponse: ' + response.getContentText());

      // Fallback: utiliser CalendarApp (sans colorId)
      Logger.log('  ↓ Fallback à CalendarApp');
      return getCalendarEventsFallback(calendarId);
    }

    const result = [];
    const data = JSON.parse(response.getContentText());
    const events = data.items || [];

    Logger.log('  ✅ ' + events.length + ' événements reçus');

    for (let i = 0; i < events.length; i++) {
      try {
        const event = events[i];

        // Ignorer les événements "cancelled" ou "transparentBusyStatus"
        if (event.status === 'cancelled') {
          continue;
        }

        const startDateTime = event.start.dateTime || event.start.date;
        const endDateTime = event.end.dateTime || event.end.date;

        if (!startDateTime) {
          Logger.log('  ⚠️ Événement sans startDateTime: ' + event.summary);
          continue;
        }

        const startTime = new Date(startDateTime);
        const endTime = new Date(endDateTime);

        // Obtenir le colorId (peut être undefined si pas défini)
        const colorId = event.colorId ? String(event.colorId) : '';

        const eventData = {
          title: String(event.summary || '[Sans titre]'),
          description: stripInternal(event.description),
          startDate: formatDate(startTime),
          startDateTime: startTime.toISOString(),
          endDateTime: endTime.toISOString(),
          isAllDay: !event.start.dateTime, // si pas de dateTime, c'est all day
          visibility: String(event.visibility || 'default'),
          location: String(event.location || ''),
          colorId: colorId,
          id: String(event.id)
        };

        result.push(eventData);

        Logger.log('    • ' + event.summary + ' | ColorID: ' + (colorId || '[aucune]') + ' | ' + eventData.startDate);
      } catch (eventError) {
        Logger.log('  ⚠️ Erreur pour événement ' + i + ': ' + eventError);
      }
    }

    return result;
  } catch (error) {
    Logger.log('❌ Erreur getCalendarEventsWithAPI (' + calendarId + '): ' + error);
    return getCalendarEventsFallback(calendarId);
  }
}

function getCalendarEventsFallback(calendarId) {
  try {
    Logger.log('📖 Fallback: CalendarApp.getCalendarById()');

    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log('  ❌ Calendrier non trouvé: ' + calendarId);
      return [];
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 2, 1);

    const events = calendar.getEvents(startDate, endDate);
    Logger.log('  ✅ ' + events.length + ' événements reçus (sans colorId)');

    const result = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      try {
        const startTime = event.getStartTime();
        const endTime = event.getEndTime();

        const eventData = {
          title: String(event.getTitle() || '[Sans titre]'),
          description: stripInternal(event.getDescription()),
          startDate: formatDate(startTime),
          startDateTime: startTime.toISOString(),
          endDateTime: endTime.toISOString(),
          isAllDay: event.isAllDayEvent(),
          visibility: String(event.getVisibility() || 'public'),
          location: String(event.getLocation() || ''),
          colorId: '', // pas de colorId en fallback
          id: String(event.getId())
        };

        result.push(eventData);
      } catch (eventError) {
        Logger.log('  ⚠️ Erreur pour événement ' + i + ': ' + eventError);
      }
    }

    return result;
  } catch (error) {
    Logger.log('❌ Erreur getCalendarEventsFallback: ' + error);
    return [];
  }
}

// Retire tout ce qui suit le marqueur ---interne--- (ne doit jamais quitter le serveur)
// Tolère majuscules, espaces, tirets longs et balises HTML insérées par Google Agenda
function stripInternal(description) {
  if (!description) return '';
  const text = String(description);
  const match = text.search(/(?:-{2,}|[–—]+)\s*(?:<[^>]*>\s*)*interne\s*(?:<[^>]*>\s*)*(?:-{2,}|[–—]+)/i);
  return match === -1 ? text.trim() : text.substring(0, match).trim();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Test local - À APPELER DEPUIS GOOGLE APPS SCRIPT
function testGetEvents() {
  try {
    Logger.log('═══════════════════════════════════════');
    Logger.log('🧪 TEST: getPublicEvents()');
    Logger.log('═══════════════════════════════════════');

    const result = getPublicEvents();

    Logger.log('');
    Logger.log('📊 RÉSUMÉ');
    Logger.log('  JDS: ' + result.jds.length + ' événements');
    Logger.log('  JDR: ' + result.jdr.length + ' événements');
    Logger.log('  Généré: ' + result.generated);

    if (result.jds.length > 0) {
      Logger.log('');
      Logger.log('📅 PREMIERS ÉVÉNEMENTS JDS:');
      result.jds.slice(0, 3).forEach((e, idx) => {
        Logger.log('  [' + (idx + 1) + '] ' + e.title);
        Logger.log('      Date: ' + e.startDate);
        Logger.log('      ColorID: ' + (e.colorId || '[AUCUNE]'));
        Logger.log('      Visibility: ' + e.visibility);
      });
    }

    if (result.jdr.length > 0) {
      Logger.log('');
      Logger.log('⚔️  PREMIERS ÉVÉNEMENTS JDR:');
      result.jdr.slice(0, 3).forEach((e, idx) => {
        Logger.log('  [' + (idx + 1) + '] ' + e.title);
        Logger.log('      Date: ' + e.startDate);
        Logger.log('      ColorID: ' + (e.colorId || '[AUCUNE]'));
        Logger.log('      Visibility: ' + e.visibility);
      });
    }

    Logger.log('');
    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ TEST TERMINÉ');
    Logger.log('═══════════════════════════════════════');

  } catch (error) {
    Logger.log('❌ ERREUR TEST: ' + error);
    Logger.log(error.stack);
  }
}
