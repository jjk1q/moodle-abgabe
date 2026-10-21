// Einstellungen an einer Stelle
export const MOODLE_URL = 'https://edufs.edu.htl-leonding.ac.at/moodle';

// Schlüssel im localStorage (das Passwort wird nie gespeichert)
export const KEYS = {
  token: 'moodle_token',
  userid: 'moodle_userid',
  courseid: 'moodle_courseid',
  coursename: 'moodle_coursename',
};

// Fotos werden vor dem PDF verkleinert (lange Seite in Pixeln) und als JPEG gespeichert
export const MAX_IMAGE_SIDE = 2000;
export const JPEG_QUALITY = 0.8;

// A4 in PDF-Punkten und Rand
export const A4 = { width: 595.28, height: 841.89, margin: 20 };
