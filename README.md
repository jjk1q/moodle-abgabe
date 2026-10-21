# Moodle-Abgabe (Mathe-Hausaufgabe per Handy)

Kleine Web-App, mit der du Fotos deiner Hausaufgabe aufnimmst, daraus ein PDF erstellst und direkt im Schul-Moodle (<https://edufs.edu.htl-leonding.ac.at/moodle>) abgibst.

Reines HTML, CSS und JavaScript. Kein Server, keine Datenbank, keine Frameworks. Das PDF wird mit [pdf-lib](https://pdf-lib.js.org/) (Version 1.17.1, liegt in `lib/`) direkt im Browser erstellt.

## Benutzung

1. Seite öffnen (GitHub Pages): <https://jjk1q.github.io/moodle-abgabe/>
2. Mit Moodle-Benutzername und Passwort anmelden.
3. Beim ersten Mal den Mathe-Kurs auswählen. Er wird gemerkt (über „Kurs wechseln“ änderbar).
4. Eine offene Aufgabe wählen (nur Aufgaben mit Dateiabgabe, die noch nicht abgegeben sind).
5. Fotos aufnehmen oder aus der Galerie wählen. Jedes Foto wird eine eigene A4-Seite, in der Reihenfolge der Auswahl. Mit ↑ ↓ ✕ kannst du sortieren oder löschen.
6. „Abgeben“ drücken und mit „Wirklich abgeben?“ bestätigen.
7. Es erscheint „Erfolgreich abgegeben“ oder eine verständliche Fehlermeldung.

Vor dem Upload prüft die App die Einstellungen der Aufgabe: ob PDF erlaubt ist (`filetypeslist`) und ob das PDF klein genug ist (`maxsubmissionsizebytes`).

## Was wird gespeichert und wo?

| Was | Wo | Wann gelöscht |
|---|---|---|
| Passwort | **nirgends**. Es geht nur einmal per POST an `login/token.php` von Moodle und wird danach aus dem Formular gelöscht | sofort |
| Anmelde-Token, Benutzer-ID, gewählter Kurs | `localStorage` deines Browsers | bei „Abmelden“ |
| Fotos und PDF | nur im Arbeitsspeicher des Browsers | beim Verlassen der Seite bzw. nach der Abgabe |

Es gibt keine Analyse, keine Cookies und keine externen Skripte, Schriften oder Bilder. Eine Content-Security-Policy in `index.html` erlaubt Netzwerkzugriffe ausschließlich auf den Moodle-Server. Der Token wird weder in der Konsole noch in der Oberfläche angezeigt.

## Dateien

```
index.html        Seite und Content-Security-Policy
css/style.css     Aussehen (mobile-first)
js/config.js      Moodle-Adresse und Einstellungen
js/storage.js     localStorage
js/moodle.js      alle Moodle-Anfragen
js/pdf.js         Fotos verkleinern und PDF erstellen
js/ui.js          Hilfen für die Oberfläche
js/app.js         Ablauf der App
lib/pdf-lib.min.js  PDF-Bibliothek
```

## Veröffentlichen (GitHub Pages)

Repository auf GitHub → Settings → Pages → „Deploy from a branch“ → Branch `main`, Ordner `/ (root)`.

## Hinweise

- iPhone-Fotos im HEIC-Format werden von Safari beim Auswählen automatisch in JPEG umgewandelt. Auf anderen Browsern kann HEIC fehlschlagen, dann wird eine Meldung angezeigt.
- Wenn die Schule Moodle auf eine andere Adresse umstellt, `js/config.js` und die CSP in `index.html` anpassen.
