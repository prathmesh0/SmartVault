import fileType from 'file-type';
import { ApiError } from './ApiError.js';

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/plain']);

interface DetectedType {
  mimeType: string;
  extension: string;
}

export async function detectAndValidateFileType(buffer: Buffer): Promise<DetectedType> {
  const detected = await fileType.fromBuffer(buffer);

  if (detected) {
    // A real, recognizable file signature was found (this is how a
    // renamed .exe or .png gets caught even if its extension says .pdf).
    if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw ApiError.unsupportedMediaType(`Detected file type "${detected.mime}" is not allowed`);
    }
    return { mimeType: detected.mime, extension: detected.ext };
  }

  // No known binary signature matched — the only type we accept without
  // one is plain text, so check that the bytes actually look like text.
  if (isProbablyPlainText(buffer)) {
    return { mimeType: 'text/plain', extension: 'txt' };
  }

  throw ApiError.unsupportedMediaType('Could not verify this file as a supported type');
}

function isProbablyPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;

  const sample = buffer.subarray(0, Math.min(buffer.length, 8_000));
  if (sample.includes(0)) return false; // a null byte almost never appears in real text

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}
