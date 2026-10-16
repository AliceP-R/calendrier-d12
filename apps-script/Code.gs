// Google Apps Script pour Au Dé 12 : envoie au site les évènements publics des deux agendas
// et la configuration lue dans le Google Sheet « Calendrier d12 - config ».
// À copier-coller ENTIÈREMENT dans script.google.com.
// Lecture seule : ce script ne modifie jamais ni les agendas ni le Sheet.

const JDS_CALENDAR_ID = 'c_b182530e0a332b3e4f20ff0c2308bb5010f8c91130af1b6e6828aa6a15751a6e@group.calendar.google.com';
const JDR_CALENDAR_ID = 'gestionjdr@au-de12paris.com';
const CONFIG_SHEET_ID = '1h5VLpM1BzCOCLynVthGn_mlE1u2_bkUW0KaSSQIEkJ8';

// Le Sheet est relu au plus toutes les 5 minutes
const CONFIG_CACHE_SECONDS = 300;

function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : null;
  let data;
  try {
    data = getPublicData();
  } catch (error) {
    Logger.log('Erreur doGet : ' + error);
    data = { error: String(error) };
  }

  const json = JSON.stringify(data);
  // JSONP : le nom de la fonction ne peut contenir que lettres, chiffres, _ $ et .
  if (callback && /^[\w$.]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Mois en cours et mois suivant
function getPublicData() {
  const config = getConfig();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  return {
    jds: getCalendarEvents(JDS_CALENDAR_ID, 'jds', config, startDate, endDate),
    jdr: getCalendarEvents(JDR_CALENDAR_ID, 'jdr', config, startDate, endDate),
    config: config,
    generated: now.toISOString()
  };
}

// ─── Évènements ─────────────────────────────────────────────────────────────

// Ne garde que les évènements publics dont l'étiquette figure dans l'onglet Couleurs :
// les autres (sans couleur, couleur inconnue, privés) ne quittent jamais le serveur.
function getCalendarEvents(calendarId, type, config, startDate, endDate) {
  const couleurs = config.couleurs[type] || {};
  const result = [];
  let pageToken = '';

  do {
    // Service avancé « Calendar » (activé dans le projet) : donne le colorId de chaque évènement.
    // singleEvents=true déplie les évènements récurrents
    let data;
    try {
      data = Calendar.Events.list(calendarId, {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 250,
        pageToken: pageToken || undefined
      });
    } catch (error) {
      throw new Error('Agenda ' + type.toUpperCase() + ' illisible : ' + error.message);
    }

    (data.items || []).forEach(event => {
      const visibility = String(event.visibility || 'default').toLowerCase();
      if (event.status === 'cancelled' || visibility === 'private' || visibility === 'confidential') return;
      if (!event.start || !(event.start.dateTime || event.start.date)) return;
      const colorId = event.colorId ? String(event.colorId) : '';
      if (!couleurs[colorId]) return;

      const isAllDay = !event.start.dateTime;
      const start = new Date(event.start.dateTime || event.start.date);
      result.push({
        title: String(event.summary || ''),
        description: stripInternal(event.description),
        startDate: isAllDay ? event.start.date : formatDate(start),
        startDateTime: start.toISOString(),
        endDateTime: new Date(event.end.dateTime || event.end.date).toISOString(),
        isAllDay: isAllDay,
        location: String(event.location || ''),
        colorId: colorId,
        id: String(event.id)
      });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return result;
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

// ─── Configuration (Google Sheet) ───────────────────────────────────────────

// Sheet relu au plus toutes les 5 minutes. S'il est illisible, on reprend
// la dernière configuration lue avec succès (gardée dans les propriétés du script).
function getConfig() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('config');
  if (cached) return JSON.parse(cached);

  let config;
  try {
    config = readConfigFromSheet();
    saveLastConfig(config);
  } catch (error) {
    Logger.log('⚠️ Sheet illisible, dernière configuration connue utilisée : ' + error);
    config = loadLastConfig();
    if (!config) throw new Error('Configuration illisible et aucune copie de secours : ' + error);
  }
  cache.put('config', JSON.stringify(config), CONFIG_CACHE_SECONDS);
  return config;
}

function readConfigFromSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG_SHEET_ID);
  const couleurs = { jds: {}, jdr: {} };

  readTable(spreadsheet, 'Couleurs').forEach(row => {
    const type = String(row['calendrier'] || '').trim().toLowerCase();
    const id = String(row['id'] || '').trim();
    if (!couleurs[type] || !id) return;

    let teinte = String(row['teinte'] || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(teinte)) {
      Logger.log('⚠️ Teinte invalide pour ' + type.toUpperCase() + ' ' + id + ' : « ' + teinte + ' »');
      teinte = '#6B5646';
    }

    const salle = normalize(row['salle']);
    couleurs[type][id] = {
      nom: String(row['nom'] || '').trim(),
      teinte: teinte,
      // En JDR, une étiquette sans effet précisé bloque la salle
      salle: type === 'jdr' ? (['libre', 'ligue'].indexOf(salle) !== -1 ? salle : 'bloque') : '',
      phrase: String(row['phrase'] || '').trim(),
      bouton: readBouton(row)
    };
  });

  const liens = {};
  readTable(spreadsheet, 'Liens').forEach(row => {
    const cle = String(row['cle'] || '').trim().toLowerCase();
    const valeur = String(row['valeur'] || '').trim();
    if (cle && valeur) liens[cle] = valeur;
  });

  return { couleurs: couleurs, liens: liens };
}

// Bouton de la fenêtre de détail : null si pas de texte ou type inconnu
function readBouton(row) {
  const texte = String(row['texte du bouton'] || '').trim();
  const type = normalize(row['type de bouton']);
  if (!texte) return null;
  if (type === 'lien externe') return { type: 'externe', texte: texte };
  if (type !== 'demande') {
    Logger.log('⚠️ Type de bouton inconnu : « ' + row['type de bouton'] + ' »');
    return null;
  }
  return {
    type: 'demande',
    texte: texte,
    objet: String(row['objet du mail'] || '').trim(),
    message: String(row['message'] || '').trim(),
    canaux: ['mail', 'discord', 'instagram', 'meetup', 'vibes'].filter(canal => isTrue(row[canal]))
  };
}

// Lignes d'un onglet sous forme d'objets, repérées par leur en-tête :
// « ID (ne pas toucher) » → id, « Nom (légende) » → nom, « Salle (JDR) » → salle…
function readTable(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Onglet « ' + sheetName + ' » introuvable');
  const values = sheet.getDataRange().getValues();
  const headers = (values.shift() || []).map(normalize);
  return values
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => { if (header) obj[header] = row[i]; });
      return obj;
    });
}

// Minuscules, sans accents, sans texte entre parenthèses ni espaces superflus
function normalize(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Case cochée, VRAI ou TRUE
function isTrue(value) {
  return value === true || ['vrai', 'true', 'oui', 'x'].indexOf(normalize(value)) !== -1;
}

// Copie de secours, découpée en morceaux (une propriété est limitée à 9 Ko)
function saveLastConfig(config) {
  const json = JSON.stringify(config);
  const props = {};
  let count = 0;
  for (let i = 0; i < json.length; i += 2000) props['config_' + count++] = json.substring(i, i + 2000);
  props.config_count = String(count);
  PropertiesService.getScriptProperties().setProperties(props);
}

function loadLastConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const count = parseInt(props.config_count, 10);
  if (!count) return null;
  let json = '';
  for (let i = 0; i < count; i++) json += props['config_' + i] || '';
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

// ─── Tests : à lancer depuis l'éditeur Apps Script (bouton Exécuter) ─────────

// Lit le Sheet, affiche ce qui a été compris et enregistre la copie de secours
function testConfig() {
  const config = readConfigFromSheet();
  saveLastConfig(config);
  CacheService.getScriptCache().remove('config');
  ['jds', 'jdr'].forEach(type => {
    Logger.log('── ' + type.toUpperCase());
    Object.keys(config.couleurs[type]).forEach(id => {
      const c = config.couleurs[type][id];
      Logger.log('  ID ' + id + ' : ' + c.nom + ' ' + c.teinte + (c.salle ? ' | salle : ' + c.salle : '') +
                 ' | bouton : ' + (c.bouton ? c.bouton.texte + ' (' + c.bouton.type + ')' : 'aucun') +
                 (c.bouton && c.bouton.canaux ? ' via ' + c.bouton.canaux.join(', ') : ''));
    });
  });
  Logger.log('── Liens');
  Object.keys(config.liens).forEach(cle => Logger.log('  ' + cle + ' : ' + config.liens[cle]));
  Logger.log('✅ Configuration lue et copie de secours enregistrée');
}

// Affiche les évènements qui seront envoyés au site
function testGetEvents() {
  const data = getPublicData();
  ['jds', 'jdr'].forEach(type => {
    Logger.log('── ' + type.toUpperCase() + ' : ' + data[type].length + ' évènements publics');
    data[type].forEach(e => {
      Logger.log('  ' + e.startDate + ' | ' + e.title + ' | ' + data.config.couleurs[type][e.colorId].nom);
    });
  });
}
