import { PDFParse } from 'pdf-parse';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import type { ExtractedText } from './extractor.types.js';

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // normalize Windows line endings
    .replace(/[ \t]+/g, ' ') // collapse repeated spaces/tabs
    .replace(/\n{3,}/g, '\n\n') // collapse 3+ blank lines to a single blank line
    .trim();
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw ApiError.unprocessableEntity(
      'Could not read this PDF — it may be corrupted or in an unsupported format',
    );
  } finally {
    await parser.destroy();
  }
}

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

export const extractorService = {
  async extract(buffer: Buffer, mimeType: string): Promise<ExtractedText> {
    const raw =
      mimeType === 'application/pdf' ? await extractFromPdf(buffer) : extractFromTxt(buffer);

    const normalized = normalize(raw);

    if (normalized.length === 0) {
      // The parser succeeded but found nothing — the classic scanned/
      // image-only PDF case. Not a crash, but not usable either.
      throw ApiError.unprocessableEntity(
        'No readable text found in this file (it may be a scanned or image-only document)',
      );
    }

    const truncated = normalized.slice(0, env.MAX_EXTRACTED_CHARS);
    return { text: truncated, length: truncated.length };
  },
};
