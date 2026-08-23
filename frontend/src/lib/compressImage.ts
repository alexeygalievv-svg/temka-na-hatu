const MAX_EDGE = 1600;
const QUALITY = 0.82;
const DRAFT_EDGE = 720;
const DRAFT_QUALITY = 0.68;

function drawToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality = QUALITY,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

/** Сжимает снимок до JPEG, чтобы он уезжал в базу и не ронял телефон. */
export async function compressImage(
  file: File,
  maxEdge = MAX_EDGE,
  quality = QUALITY,
): Promise<File> {
  try {
    let width = 0;
    let height = 0;
    let blob: Blob | null = null;

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
      blob = await drawToJpeg(bitmap, width, height, quality);
      bitmap.close();
    } catch {
      const image = await loadImage(file);
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      width = Math.max(1, Math.round(image.naturalWidth * scale));
      height = Math.max(1, Math.round(image.naturalHeight * scale));
      blob = await drawToJpeg(image, width, height, quality);
    }

    if (!blob) return file;
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Более лёгкий JPEG для localStorage, чтобы черновик не вытеснял фото. */
export function compressImageForDraft(file: File): Promise<File> {
  return compressImage(file, DRAFT_EDGE, DRAFT_QUALITY);
}

function fileFromDataUrl(dataUrl: string, name: string): File | null {
  try {
    const [header, base64] = dataUrl.split(',');
    if (!base64) return null;
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  } catch {
    return null;
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function fileFromPreview(
  file: File | null | undefined,
  preview: string | null | undefined,
  name = 'photo.jpg',
): Promise<File | null> {
  if (file instanceof File && file.size > 0) return file;
  if (!preview) return null;
  if (preview.startsWith('data:')) return fileFromDataUrl(preview, name);
  try {
    const blob = await fetch(preview).then((response) => response.blob());
    if (!blob.size) return null;
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}
