// Ablauf: Anmeldung -> Kurs -> Aufgaben -> Fotos -> Abgabe
import { KEYS } from './config.js';
import * as storage from './storage.js';
import * as moodle from './moodle.js';
import * as pdf from './pdf.js';
import { $, showScreen, showError, hideError, setBusy, formatDate, formatSize, confirmDialog } from './ui.js';

let userid = null;
let current = null; // gewählte Aufgabe
let photos = [];    // { blob, url } in Auswahl-Reihenfolge

// ---------- Hilfen ----------

// Fehler anzeigen; bei ungültigem Token zurück zur Anmeldung
function handleError(e) {
  if (e && e.code === 'invalidtoken') {
    storage.clearSession();
    showScreen('login');
  }
  showError(e && e.message ? e.message : 'Unbekannter Fehler.');
}

async function busy(fn) {
  setBusy(true);
  try { return await fn(); } finally { setBusy(false); }
}

// Prüft, ob die Aufgabe PDF erlaubt (filetypeslist)
function pdfAllowed(types) {
  if (!types) return true;
  const list = types.toLowerCase().split(/[\s,;:]+/).filter(Boolean);
  if (!list.length) return true;
  return list.some((t) => ['*', '.pdf', 'pdf', 'application/pdf', 'document'].includes(t));
}

// ---------- Anmeldung ----------

async function doLogin(ev) {
  ev.preventDefault();
  hideError();
  const user = $('username').value.trim();
  let pass = $('password').value;
  $('password').value = ''; // Passwort sofort aus dem Formular löschen
  try {
    await busy(async () => {
      const token = await moodle.login(user, pass);
      pass = null;
      storage.set(KEYS.token, token);
      userid = await moodle.getUserId();
      storage.set(KEYS.userid, userid);
    });
    await afterLogin();
  } catch (e) {
    pass = null;
    handleError(e);
  }
}

function logout() {
  storage.clearSession();
  userid = null;
  current = null;
  clearPhotos();
  showScreen('login');
}

async function afterLogin() {
  if (storage.get(KEYS.courseid)) await openAssignments();
  else await openCourses();
}

// ---------- Kurs ----------

async function openCourses() {
  try {
    const courses = await busy(() => moodle.getCourses(userid));
    const ul = $('course-list');
    ul.replaceChildren();
    for (const c of courses) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.name;
      b.addEventListener('click', () => {
        storage.set(KEYS.courseid, c.id);
        storage.set(KEYS.coursename, c.name);
        openAssignments();
      });
      li.append(b);
      ul.append(li);
    }
    showScreen('courses');
    if (!courses.length) showError('Keine Kurse gefunden.');
  } catch (e) { handleError(e); }
}

// ---------- Aufgaben ----------

let allAssignments = [];
let filter = 'all'; // all | open | late

const isLate = (a) => a.duedate && a.duedate < Date.now() / 1000;

function setFilter(name) {
  filter = name;
  renderAssignments();
}

function renderAssignments() {
  const late = allAssignments.filter(isLate);
  const open = allAssignments.filter((a) => !isLate(a));
  $('count-all').textContent = '(' + allAssignments.length + ')';
  $('count-open').textContent = '(' + open.length + ')';
  $('count-late').textContent = '(' + late.length + ')';
  document.querySelectorAll('.chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
  });
  const list = filter === 'late' ? late : filter === 'open' ? open : allAssignments;
  const ul = $('assignment-list');
  ul.replaceChildren();
  for (const a of list) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.name;
    const due = document.createElement('span');
    due.className = 'due' + (isLate(a) ? ' late' : '');
    due.textContent = (isLate(a) ? 'Überfällig: ' : 'Fällig: ') + formatDate(a.duedate);
    b.append(due);
    b.addEventListener('click', () => openSubmit(a));
    li.append(b);
    ul.append(li);
  }
  $('assignments-empty').hidden = list.length > 0;
}

async function openAssignments() {
  try {
    allAssignments = await busy(() => moodle.getOpenAssignments(storage.get(KEYS.courseid), userid));
    $('course-name').textContent = storage.get(KEYS.coursename) || 'Aufgaben';
    renderAssignments();
    showScreen('assignments');
  } catch (e) { handleError(e); }
}

// ---------- Abgabe ----------

function clearPhotos() {
  photos.forEach((p) => URL.revokeObjectURL(p.url));
  photos = [];
}

function openSubmit(assign) {
  current = assign;
  clearPhotos();
  $('assignment-title').textContent = assign.name;
  $('assignment-due').textContent = 'Fällig: ' + formatDate(assign.duedate);
  const limits = [];
  if (assign.maxBytes > 0) limits.push('max. ' + formatSize(assign.maxBytes));
  if (assign.fileTypes) limits.push('erlaubt: ' + assign.fileTypes);
  $('assignment-limits').textContent = limits.join(' · ');
  renderPhotos();
  showScreen('submit');
  if (!pdfAllowed(assign.fileTypes)) {
    showError('Bei dieser Aufgabe sind PDF-Dateien nicht erlaubt (erlaubt: ' + assign.fileTypes + '). Abgabe mit der App nicht möglich.');
  }
}

function renderPhotos() {
  const ol = $('photo-list');
  ol.replaceChildren();
  photos.forEach((p, i) => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = p.url;
    img.alt = 'Seite ' + (i + 1);
    const label = document.createElement('span');
    label.className = 'grow';
    label.textContent = 'Seite ' + (i + 1);
    li.append(img, label, btn('↑', 'Nach oben', () => move(i, -1), i === 0), btn('↓', 'Nach unten', () => move(i, 1), i === photos.length - 1), btn('✕', 'Entfernen', () => remove(i)));
    ol.append(li);
  });
  $('photo-empty').hidden = photos.length > 0;
  $('btn-submit').disabled = photos.length === 0 || !pdfAllowed(current.fileTypes);
}

function btn(text, label, onClick, disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function move(i, d) {
  [photos[i], photos[i + d]] = [photos[i + d], photos[i]];
  renderPhotos();
}

function remove(i) {
  URL.revokeObjectURL(photos[i].url);
  photos.splice(i, 1);
  renderPhotos();
}

async function addFiles(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  hideError();
  if (!files.length) return;
  setBusy(true);
  try {
    for (const f of files) {
      const blob = await pdf.toJpeg(f);
      photos.push({ blob, url: URL.createObjectURL(blob) });
    }
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
    renderPhotos();
  }
}

function progress(text) {
  const p = $('progress');
  p.textContent = text;
  p.hidden = !text;
}

async function doSubmit() {
  hideError();
  if (!current || !photos.length) return;
  if (!pdfAllowed(current.fileTypes)) {
    showError('PDF-Dateien sind bei dieser Aufgabe nicht erlaubt.');
    return;
  }
  if (!(await confirmDialog(current.name, photos.length))) return;

  $('btn-submit').disabled = true;
  setBusy(true);
  try {
    progress('PDF wird erstellt …');
    const file = await pdf.buildPdf(photos.map((p) => p.blob));
    // Größe vor dem Upload prüfen
    if (current.maxBytes > 0 && file.size > current.maxBytes) {
      throw new Error('Das PDF ist zu groß (' + formatSize(file.size) + '). Erlaubt sind höchstens '
        + formatSize(current.maxBytes) + '. Bitte weniger Fotos abgeben.');
    }
    progress('Wird hochgeladen …');
    const itemid = await moodle.uploadPdf(file, 'Abgabe.pdf');
    progress('Wird abgegeben …');
    await moodle.submit(current, itemid);
    $('done-name').textContent = current.name;
    clearPhotos();
    showScreen('done');
  } catch (e) {
    handleError(e);
  } finally {
    progress('');
    setBusy(false);
    if (!$('screen-submit').hidden) renderPhotos();
  }
}

// ---------- Start ----------

function init() {
  $('login-form').addEventListener('submit', doLogin);
  $('btn-logout').addEventListener('click', logout);
  $('btn-change-course').addEventListener('click', openCourses);
  $('btn-reload').addEventListener('click', openAssignments);
  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => setFilter(c.dataset.filter)));
  $('btn-back').addEventListener('click', () => { clearPhotos(); openAssignments(); });
  $('btn-done').addEventListener('click', openAssignments);
  $('btn-submit').addEventListener('click', doSubmit);
  $('input-camera').addEventListener('change', (e) => addFiles(e.target));
  $('input-gallery').addEventListener('change', (e) => addFiles(e.target));

  if (storage.get(KEYS.token)) {
    userid = storage.get(KEYS.userid);
    (async () => {
      try {
        if (!userid) {
          userid = await busy(() => moodle.getUserId());
          storage.set(KEYS.userid, userid);
        }
        await afterLogin();
      } catch (e) { showScreen('login'); handleError(e); }
    })();
  } else {
    showScreen('login');
  }
}

init();
