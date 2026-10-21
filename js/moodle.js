// Alle Anfragen an Moodle. Das ist die einzige Datei mit fetch().
// Der Token wird nie geloggt oder angezeigt.
import { MOODLE_URL, KEYS } from './config.js';
import * as storage from './storage.js';

export class MoodleError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function readJson(res) {
  if (!res.ok) throw new MoodleError('Moodle antwortet mit Fehler ' + res.status + '.', 'http');
  try {
    return await res.json();
  } catch {
    throw new MoodleError('Unerwartete Antwort von Moodle.', 'badresponse');
  }
}

async function send(url, body) {
  try {
    return await fetch(url, { method: 'POST', body });
  } catch {
    throw new MoodleError('Keine Verbindung zu Moodle. Bitte Internet prüfen.', 'network');
  }
}

// Anmeldung: Passwort geht nur an login/token.php
export async function login(username, password) {
  const body = new URLSearchParams({ username, password, service: 'moodle_mobile_app' });
  const data = await readJson(await send(MOODLE_URL + '/login/token.php', body));
  if (data.token) return data.token;
  throw new MoodleError('Benutzername oder Passwort falsch.', data.errorcode || 'login');
}

// Webservice-Aufruf; params sind schon flach, z.B. { 'courseids[0]': 5 }
async function call(wsfunction, params = {}) {
  const body = new URLSearchParams({
    wstoken: storage.get(KEYS.token) || '',
    wsfunction,
    moodlewsrestformat: 'json',
  });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const data = await readJson(await send(MOODLE_URL + '/webservice/rest/server.php', body));
  if (data && data.exception) {
    const code = data.errorcode || 'moodle';
    if (code === 'invalidtoken' || code === 'accessexception') {
      throw new MoodleError('Die Anmeldung ist abgelaufen. Bitte neu anmelden.', 'invalidtoken');
    }
    throw new MoodleError(data.message || 'Moodle-Fehler.', code);
  }
  return data;
}

export async function getUserId() {
  const info = await call('core_webservice_get_site_info');
  return info.userid;
}

export async function getCourses(userid) {
  const courses = await call('core_enrol_get_users_courses', { userid });
  return courses.map((c) => ({ id: c.id, name: c.fullname || c.shortname }));
}

// Wert aus configs eines Plugins lesen
function pluginConfig(assign, plugin, name) {
  const c = (assign.configs || []).find((x) => x.plugin === plugin && x.subtype === 'assignsubmission' && x.name === name);
  return c ? c.value : undefined;
}

function toAssignment(a) {
  return {
    id: a.id,
    name: a.name,
    duedate: a.duedate,
    cutoffdate: a.cutoffdate,
    allowfrom: a.allowsubmissionsfromdate,
    needsSubmitStep: Number(a.submissiondrafts) === 1,
    needsStatement: Number(a.requiresubmissionstatement) === 1,
    fileEnabled: pluginConfig(a, 'file', 'enabled') === '1',
    maxBytes: Number(pluginConfig(a, 'file', 'maxsubmissionsizebytes') || 0),
    maxFiles: Number(pluginConfig(a, 'file', 'maxfilesubmissions') || 0),
    fileTypes: (pluginConfig(a, 'file', 'filetypeslist') || '').trim(),
    textOnly: Number(a.nosubmissions) === 1,
  };
}

async function isAlreadySubmitted(assignid, userid) {
  try {
    const st = await call('mod_assign_get_submission_status', { assignid, userid });
    const last = st.lastattempt;
    if (!last) return false;
    if (last.submission && last.submission.status === 'submitted') return true;
    return last.caneditowner === false; // gesperrt: nicht anbieten
  } catch (e) {
    if (e.code === 'invalidtoken') throw e;
    return false; // im Zweifel anzeigen
  }
}

// Offene Aufgaben mit Dateiabgabe, die noch nicht abgegeben sind
export async function getOpenAssignments(courseid, userid) {
  const data = await call('mod_assign_get_assignments', { 'courseids[0]': courseid });
  const course = (data.courses || [])[0];
  const now = Date.now() / 1000;
  const list = ((course && course.assignments) || [])
    .map(toAssignment)
    .filter((a) => a.fileEnabled && !a.textOnly)
    .filter((a) => !(a.allowfrom && a.allowfrom > now))
    .filter((a) => !(a.cutoffdate && a.cutoffdate < now));
  const flags = await Promise.all(list.map((a) => isAlreadySubmitted(a.id, userid)));
  return list.filter((_, i) => !flags[i]).sort((a, b) => (a.duedate || 1e12) - (b.duedate || 1e12));
}

// PDF hochladen; Token im Formularkörper, nicht in der URL
export async function uploadPdf(blob, filename) {
  const form = new FormData();
  form.append('token', storage.get(KEYS.token) || '');
  form.append('filearea', 'draft');
  form.append('itemid', '0');
  form.append('file_1', blob, filename);
  const data = await readJson(await send(MOODLE_URL + '/webservice/upload.php', form));
  if (data && data.error) throw new MoodleError('Upload fehlgeschlagen: ' + data.error, data.errorcode || 'upload');
  if (!Array.isArray(data) || !data[0] || !data[0].itemid) {
    throw new MoodleError('Upload fehlgeschlagen.', 'upload');
  }
  return data[0].itemid;
}

function checkWarnings(res) {
  if (Array.isArray(res) && res.length) {
    throw new MoodleError(res.map((w) => w.message).join(' '), res[0].warningcode || 'warning');
  }
}

// Entwurf speichern und (falls nötig) zur Bewertung abgeben
export async function submit(assign, itemid) {
  checkWarnings(await call('mod_assign_save_submission', {
    assignmentid: assign.id,
    'plugindata[files_filemanager]': itemid,
  }));
  if (assign.needsSubmitStep) {
    const params = { assignmentid: assign.id };
    if (assign.needsStatement) params.acceptsubmissionstatement = 1;
    checkWarnings(await call('mod_assign_submit_for_grading', params));
  }
}
