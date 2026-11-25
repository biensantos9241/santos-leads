/**
 * Santos Leads - Call Log web app (Google Apps Script, bound to the "Santos Optical Leads" Sheet).
 *
 * doGet  ?key=...            -> JSON: active call list, removed leads, call log (for the phone page)
 * doPost {key, entries:[..]}  -> appends call-log rows; "remove"/"restore" entries also change Leads Status.
 *
 * Rule (Doc Bien, t55u): leads are NEVER removed automatically. Only a removal Status set by staff,
 * or an explicit "Remove from list" on the page (logged with who/when), takes a lead off the call list.
 * Missed calls only lower the score.
 *
 * The shared key lives in Script Properties (never in GitHub). Run setupKey() once to create it.
 */
var TZ = 'Asia/Manila';
var CALLERS = ['Doc Bien', 'Maypajo staff', 'Quiapo staff', 'Paso de Blas staff', 'Symaco staff', 'SBP staff', 'Tangos staff', 'Central caller'];
var OUTCOMES = ['Reached-coming', 'Reached-not interested', 'No answer', 'Busy', 'Wrong number', 'Callback requested'];
var REMOVED_OUTCOME = 'Removed from list', RESTORED_OUTCOME = 'Restored to list';

function setupKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SANTOS_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, '').slice(0, 20); props.setProperty('SANTOS_KEY', key); }
  Logger.log('Santos Leads key: ' + key + '  (paste this on the phone page under Sync setup)');
  return key;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function keyOk_(k) { var key = PropertiesService.getScriptProperties().getProperty('SANTOS_KEY'); return !!key && k === key; }
function table_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { headers: [], rows: [] };
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  var headers = v.shift();
  return { headers: headers, rows: v.filter(function (r) { return r[0] !== ''; }) };
}

function doGet(e) {
  if (!keyOk_((e && e.parameter && e.parameter.key) || '')) return json_({ ok: false, error: 'bad key' });
  return json_({
    ok: true,
    updated: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'),
    active: table_("Today's Call List"),
    removed: table_('Removed Leads'),
    log: table_('Call Log'),
    callers: CALLERS, outcomes: OUTCOMES
  });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (!keyOk_(body.key || '')) return json_({ ok: false, error: 'bad key' });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var log = ss.getSheetByName('Call Log'), leads = ss.getSheetByName('Leads');
    var have = {};
    if (log.getLastRow() > 1) log.getRange(2, 9, log.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) have[r[0]] = 1; });
    var ids = leads.getRange(2, 1, Math.max(1, leads.getLastRow() - 1), 1).getValues().map(function (r) { return String(r[0]); });
    var statusCol = leads.getRange(1, 1, 1, leads.getLastColumn()).getValues()[0].indexOf('Status') + 1;
    var accepted = [], rejected = [];
    (body.entries || []).forEach(function (x) {
      var uid = String(x.uid || '');
      if (!uid) { rejected.push({ uid: uid, why: 'no uid' }); return; }
      if (have[uid]) { accepted.push(uid); return; }                       // already synced (retry) - idempotent
      var caller = String(x.caller || ''), outcome = String(x.outcome || '');
      if (x.action === 'remove') outcome = REMOVED_OUTCOME;
      if (x.action === 'restore') outcome = RESTORED_OUTCOME;
      if (CALLERS.indexOf(caller) < 0) { rejected.push({ uid: uid, why: 'unknown caller' }); return; }
      if (OUTCOMES.indexOf(outcome) < 0 && outcome !== REMOVED_OUTCOME && outcome !== RESTORED_OUTCOME) { rejected.push({ uid: uid, why: 'unknown outcome' }); return; }
      var row = ids.indexOf(String(x.leadId)) + 2;
      if (row < 2) { rejected.push({ uid: uid, why: 'unknown lead' }); return; }
      var ts = Utilities.parseDate(String(x.ts), TZ, 'yyyy-MM-dd HH:mm');   // phone sends Manila time
      log.appendRow([ts, x.leadId, x.name || '', "'" + String(x.phone || ''), caller, outcome, x.notes || '', 'Santos Leads page', uid]);
      if (statusCol > 0 && x.action === 'remove') leads.getRange(row, statusCol).setValue('Removed');
      if (statusCol > 0 && x.action === 'restore') leads.getRange(row, statusCol).setValue('Restored');
      have[uid] = 1; accepted.push(uid);
    });
    return json_({ ok: true, accepted: accepted, rejected: rejected });
  } finally { lock.releaseLock(); }
}
