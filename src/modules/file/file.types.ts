import type { Types } from 'mongoose';

export interface PublicFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
}

// Params of the `/:id` file routes. Express types the default params bag as
// `string | string[]` (wildcards are arrays), so controllers must state the
// concrete shape to get a plain `string` out of `req.params.id`.
export type FileRouteParams = { id: string };

export function toPublicFile(file: {
  _id: Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
}): PublicFile {
  return {
    id: file._id.toString(),
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    url: file.url,
    createdAt: file.createdAt,
  };
}

// Declared as a type alias, not an interface: only type aliases get an
// implicit index signature, so this stays assignable to `Record<string, unknown>`.
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
