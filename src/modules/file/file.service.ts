import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { sanitizeFilename } from '../../utils/sanitizeFilename.js';
import { storageService } from '../storage/storage.service.js';
import { ACTIVE_STATUSES } from './file.model.js';
import { filePipeline } from './file.pipeline.js';
import { fileRepository } from './file.repository.js';
import { toPublicFile, type PaginationMeta, type PublicFile } from './file.types.js';

interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

const RETRYABLE_STAGE = 'ANALYZING';

export const fileService = {
  async uploadFile(
    ownerId: string,
    file: IncomingFile,
    detectedMimeType: string,
  ): Promise<PublicFile> {
    const safeName = sanitizeFilename(file.originalname);

    const doc = await fileRepository.createQueued({
      owner: ownerId,
      originalName: safeName,
      mimeType: detectedMimeType,
      size: file.size,
    });

    // Fire-and-forget: deliberately NOT awaited. filePipeline.run() is
    // guaranteed to never reject (see its own doc comment), which is what
    // makes this safe. The .catch() here is a last-resort safety net in
    // case that guarantee is ever broken by a future change — without it,
    // a genuinely unexpected throw here would become an unhandled
    // rejection and crash the whole process.
    void filePipeline
      .run(doc._id.toString(), ownerId, file.buffer, detectedMimeType)
      .catch((err) => {
        logger.error(
          { err, fileId: doc._id.toString() },
          'Pipeline escaped its own error handling',
        );
      });

    return toPublicFile(doc);
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

    await fileRepository.deleteByIdAndOwner(fileId, ownerId);
    // storageKey may not exist yet if the file is still QUEUED/UPLOADING
    // when deleted — nothing to clean up on Cloudinary in that case.
    if (doc.storageKey) {
      await storageService.deleteFile(doc.storageKey);
    }
  },

  async retry(ownerId: string, fileId: string): Promise<PublicFile> {
    const doc = await fileRepository.findByIdAndOwnerWithText(fileId, ownerId);
    if (!doc) throw ApiError.notFound('File not found');

    if (ACTIVE_STATUSES.includes(doc.status)) {
      throw ApiError.conflict('File is already being processed');
    }

    if (doc.status !== 'FAILED' || doc.failedStage !== RETRYABLE_STAGE) {
      throw ApiError.conflict(
        'Only files that failed during analysis can be retried — earlier failures require re-uploading',
      );
    }

    if (!doc.extractedText) {
      // Shouldn't be reachable given the guards above (a FAILED-at-
      // ANALYZING file always has extractedText already saved), but this
      // is a cheap defensive check against a future bug.
      throw ApiError.conflict('No extracted text available to retry analysis with');
    }

    void filePipeline.retryAnalysis(fileId, ownerId, doc.extractedText).catch((err) => {
      logger.error({ err, fileId }, 'Retry pipeline escaped its own error handling');
    });

    return toPublicFile(doc);
  },

  async recoverStuckFiles(): Promise<number> {
    return fileRepository.failAllStuck('Server restarted before processing finished');
  },
};
