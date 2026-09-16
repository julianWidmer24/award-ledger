/** Downscale a chosen photo to a square JPEG so avatars stay small and consistent. */
export async function squareThumbnail(file: File, size = 512, quality = 0.86): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2, sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality));
}

export const formatBytes = (n: number | null) => {
  if (n === null || n === undefined) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

/** Downscale a photo for the feed (longest side ≤ maxSide) as JPEG; falls back to the original if it can't be decoded (e.g. HEIC on Chrome). */
export async function feedImage(file: File, maxSide = 1600, quality = 0.84): Promise<{ blob: Blob; type: string; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality));
    return { blob, type: 'image/jpeg', ext: 'jpg' };
  } catch {
    return { blob: file, type: file.type || 'application/octet-stream', ext: (file.name.split('.').pop() || 'bin').toLowerCase() };
  }
}

export const isVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
export const isImage = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name);
