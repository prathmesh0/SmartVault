import type { QueryFilter } from 'mongoose';
import { ACTIVE_STATUSES, FileModel, type FileDocument, type FileStatus, type IFile } from './file.model.js';
import type { ListFilesFilter } from './file.types.js';

interface CreateQueuedData {
  owner: string;
  originalName: string;
  mimeType: string;
  size: number;
}

// Escape user input before dropping it into a RegExp — otherwise a search
// for "a.b" (or worse, something catastrophic) would be interpreted as regex
// syntax rather than a literal string.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface AiResultData {
  summary: string;
  category: string;
  tags: string[];
  model: string;
  processedAt: Date;
}

export const fileRepository = {
  createQueued(data: CreateQueuedData): Promise<FileDocument> {
    return FileModel.create({ ...data, status: 'QUEUED', progress: 5 });
  },

  findByIdAndOwner(id: string, owner: string): Promise<FileDocument | null> {
    return FileModel.findOne({ _id: id, owner });
  },

  // Same as above, but also pulls back extractedText, which is select:false
  // by default. Only used where we actually need the text (retry).
  findByIdAndOwnerWithText(id: string, owner: string): Promise<FileDocument | null> {
    return FileModel.findOne({ _id: id, owner }).select('+extractedText');
  },

  async listByOwner(
    owner: string,
    filter: ListFilesFilter,
    page: number,
    limit: number,
  ): Promise<{ items: FileDocument[]; total: number }> {
    const query: QueryFilter<IFile> = { owner };

    if (filter.status) query.status = filter.status;
    if (filter.category) query['ai.category'] = filter.category;
    // matches the scalar tag inside the tags array
    if (filter.tag) query['ai.tags'] = filter.tag.trim().toLowerCase();

    if (filter.search) {
      const pattern = new RegExp(escapeRegex(filter.search), 'i');
      query.$or = [{ originalName: pattern }, { 'ai.summary': pattern }];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      FileModel.find(query).sort(filter.sort).skip(skip).limit(limit),
      FileModel.countDocuments(query),
    ]);
    return { items, total };
  },

  deleteByIdAndOwner(id: string, owner: string): Promise<FileDocument | null> {
    return FileModel.findOneAndDelete({ _id: id, owner });
  },

  // Moves the file forward in the state machine. $unset clears any stale
  // failure info from a PREVIOUS attempt (e.g. retrying after a failure
  // shouldn't leave the old error message sitting around once it's moving
  // again).
  async updateStatus(id: string, status: FileStatus, progress: number): Promise<void> {
    await FileModel.updateOne(
      { _id: id },
      { $set: { status, progress }, $unset: { failedStage: '', error: '' } },
    );
  },

  async setStorage(id: string, storageKey: string, url: string): Promise<void> {
    await FileModel.updateOne({ _id: id }, { $set: { storageKey, url } });
  },

  async setExtractedText(id: string, text: string): Promise<void> {
    await FileModel.updateOne({ _id: id }, { $set: { extractedText: text } });
  },

  async setAiResult(id: string, ai: AiResultData): Promise<void> {
    await FileModel.updateOne(
      { _id: id },
      { $set: { ai, status: 'COMPLETED', progress: 100 }, $unset: { failedStage: '', error: '' } },
    );
  },

  async markFailed(id: string, failedStage: string, error: string): Promise<void> {
    await FileModel.updateOne({ _id: id }, { $set: { status: 'FAILED', failedStage, error } });
  },

  // Startup recovery: anything still "in flight" when the process died has
  // no worker left to finish it. Fail them honestly instead of leaving a
  // spinner that will never resolve.
  async failAllStuck(message: string): Promise<number> {
    const result = await FileModel.updateMany(
      { status: { $in: ACTIVE_STATUSES } },
      { $set: { status: 'FAILED', failedStage: 'STARTUP', error: message } },
    );
    return result.modifiedCount;
  },
};
