import { ApiError } from '../../utils/ApiError.js';
import { sanitizeFilename } from '../../utils/sanitizeFilename.js';
import { storageService } from '../storage/storage.service.js';
import { fileRepository } from './file.repository.js';
import { toPublicFile, type PaginationMeta, type PublicFile } from './file.types.js';

interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export const fileService = {
  async uploadFile(
    ownerId: string,
    file: IncomingFile,
    detectedMimeType: string,
  ): Promise<PublicFile> {
    const safeName = sanitizeFilename(file.originalname);

    const uploadResult = await storageService.uploadBuffer(file.buffer, `vault/${ownerId}`);

    try {
      const doc = await fileRepository.create({
        owner: ownerId,
        originalName: safeName,
        mimeType: detectedMimeType,
        size: file.size,
        storageKey: uploadResult.storageKey,
        url: uploadResult.url,
      });
      return toPublicFile(doc);
    } catch (err) {
      // Compensating action: the Cloudinary upload already succeeded, but
      // saving the metadata failed. Without this, the file would sit in
      // Cloudinary forever with no database record pointing to it.
      await storageService.deleteFile(uploadResult.storageKey).catch(() => {
        // Best-effort: if even the cleanup fails, we've simply got an
        // orphan we'd need a periodic sweep job to catch later.
      });
      throw err;
    }
  },

  async getById(ownerId: string, fileId: string): Promise<PublicFile> {
    const doc = await fileRepository.findByIdAndOwner(fileId, ownerId);
    if (!doc) throw ApiError.notFound('File not found');
    return toPublicFile(doc);
  },

  async list(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<{ items: PublicFile[]; meta: PaginationMeta }> {
    const { items, total } = await fileRepository.listByOwner(ownerId, page, limit);
    return {
      items: items.map(toPublicFile),
      meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  },

  async remove(ownerId: string, fileId: string): Promise<void> {
    const doc = await fileRepository.findByIdAndOwner(fileId, ownerId);
    if (!doc) throw ApiError.notFound('File not found');

    // Delete our own record first. If the Cloudinary delete below then
    // fails, we're left with a harmless orphaned asset in Cloudinary
    // (costs a little quota) — better than the reverse order, where a
    // failed DB delete would leave a dangling record pointing at a file
    // that's already gone.
    await fileRepository.deleteByIdAndOwner(fileId, ownerId);
    await storageService.deleteFile(doc.storageKey);
  },
};
