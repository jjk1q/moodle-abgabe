// Fotos verkleinern und zu einem PDF (eine A4-Seite pro Foto) zusammensetzen
import { MAX_IMAGE_SIDE, JPEG_QUALITY, A4 } from './config.js';

async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto -> JPEG-Blob (verkleinert, weißer Hintergrund)
export async function toJpeg(file) {
  let bmp;
  try {
    bmp = await loadBitmap(file);
  } catch {
    throw new Error('Dieses Bildformat wird vom Browser nicht unterstützt (' + (file.type || 'unbekannt') + ').');
  }
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (bmp.close) bmp.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('Foto konnte nicht verarbeitet werden.');
  return blob;
}

// Liste von JPEG-Blobs -> PDF-Blob
export async function buildPdf(jpegBlobs) {
  const { PDFDocument } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const maxW = A4.width - 2 * A4.margin;
  const maxH = A4.height - 2 * A4.margin;
  for (const blob of jpegBlobs) {
    const img = await pdf.embedJpg(await blob.arrayBuffer());
    const k = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * k;
    const h = img.height * k;
    const page = pdf.addPage([A4.width, A4.height]);
    page.drawImage(img, { x: (A4.width - w) / 2, y: (A4.height - h) / 2, width: w, height: h });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
