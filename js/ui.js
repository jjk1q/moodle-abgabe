// Kleine Hilfen für die Oberfläche
export const $ = (id) => document.getElementById(id);

const SCREENS = ['login', 'courses', 'assignments', 'submit', 'done'];

export function showScreen(name) {
  SCREENS.forEach((s) => { $('screen-' + s).hidden = s !== name; });
  $('menu').hidden = name === 'login';
  hideError();
}

export function showError(message) {
  const el = $('error');
  el.textContent = message;
  el.hidden = false;
  window.scrollTo(0, 0);
}

export function hideError() {
  $('error').hidden = true;
}

export function setBusy(on) {
  $('busy').hidden = !on;
}

export function formatDate(ts) {
  if (!ts) return 'kein Abgabetermin';
  return new Date(ts * 1000).toLocaleString('de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

// Bestätigungsdialog; gibt true zurück, wenn "Abgeben" gedrückt wurde
export function confirmDialog(name, pages) {
  const dlg = $('confirm');
  $('confirm-name').textContent = name;
  $('confirm-pages').textContent = pages + (pages === 1 ? ' Seite' : ' Seiten') + ' (PDF)';
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.returnValue = 'cancel';
    dlg.showModal();
  });
}
