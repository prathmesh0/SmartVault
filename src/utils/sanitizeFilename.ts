import { basename } from 'node:path';

export function sanitizeFilename(name: string) {
  const base = basename(name);
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, '').trim();
  return cleaned.slice(0, 255) || 'untitled';
}
