import { logger } from '../../utils/logger.js';
import { aiService } from '../ai/ai.service.js';
import { extractorService } from '../extractor/extractor.service.js';
import { storageService } from '../storage/storage.service.js';
import { fileEvents } from './file.events.js';
import { FileStatus } from './file.model.js';
import { fileRepository } from './file.repository.js';

const PROGRESS: Record<Exclude<FileStatus, 'FAILED'>, number> = {
  QUEUED: 5,
  UPLOADING: 25,
  EXTRACTING: 50,
  ANALYZING: 75,
  COMPLETED: 100,
};

async function setStatus(
  fileId: string,
  ownerId: string,
  status: Exclude<FileStatus, 'FAILED'>,
  message?: string,
): Promise<void> {
  await fileRepository.updateStatus(fileId, status, PROGRESS[status]);
  fileEvents.emit('status', { ownerId, fileId, status, progress: PROGRESS[status], message });
}

async function setFailed(
  fileId: string,
  ownerId: string,
  failedStage: string,
  error: string,
): Promise<void> {
  await fileRepository.markFailed(fileId, failedStage, error);
  fileEvents.emit('failed', { ownerId, fileId, failedStage, error });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export const filePipeline = {
  async run(fileId: string, ownerId: string, buffer: Buffer, mimeType: string): Promise<void> {
    let stage: 'UPLOADING' | 'EXTRACTING' | 'ANALYZING' = 'UPLOADING';
    try {
      await setStatus(fileId, ownerId, 'UPLOADING', 'Uploading to cloud storage...');
      const uploadResult = await storageService.uploadBuffer(buffer, `vault/${ownerId}`);
      await fileRepository.setStorage(fileId, uploadResult.storageKey, uploadResult.url);

      stage = 'EXTRACTING';
      await setStatus(fileId, ownerId, 'EXTRACTING', 'Extracting text...');
      const { text } = await extractorService.extract(buffer, mimeType);
      await fileRepository.setExtractedText(fileId, text);

      stage = 'ANALYZING';
      await setStatus(fileId, ownerId, 'ANALYZING', 'Generating summary and tags...');
      const analysis = await aiService.analyzeDocument(text);
      await fileRepository.setAiResult(fileId, {
        summary: analysis.summary,
        category: analysis.category,
        tags: analysis.tags,
        model: analysis.model,
        processedAt: new Date(),
      });

      fileEvents.emit('completed', {
        ownerId,
        fileId,
        ai: { summary: analysis.summary, category: analysis.category, tags: analysis.tags },
      });
    } catch (err) {
      logger.error({ err, fileId, stage }, 'File pipeline failed');
      await setFailed(fileId, ownerId, stage, errorMessage(err));
    }
  },

  async retryAnalysis(fileId: string, ownerId: string, text: string): Promise<void> {
    try {
      await setStatus(fileId, ownerId, 'ANALYZING', 'Retrying analysis...');
      const analysis = await aiService.analyzeDocument(text);
      await fileRepository.setAiResult(fileId, {
        summary: analysis.summary,
        category: analysis.category,
        tags: analysis.tags,
        model: analysis.model,
        processedAt: new Date(),
      });

      fileEvents.emit('completed', {
        ownerId,
        fileId,
        ai: { summary: analysis.summary, category: analysis.category, tags: analysis.tags },
      });
    } catch (err) {
      logger.error({ err, fileId }, 'Retry analysis failed');
      await setFailed(fileId, ownerId, 'ANALYZING', errorMessage(err));
    }
  },
};
