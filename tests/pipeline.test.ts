import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiService } from '../src/modules/ai/ai.service.js';
import { fileEvents } from '../src/modules/file/file.events.js';
import { FileModel } from '../src/modules/file/file.model.js';
import { filePipeline } from '../src/modules/file/file.pipeline.js';
import { storageService } from '../src/modules/storage/storage.service.js';

// Replace the two external integrations so the pipeline runs fully offline.
vi.mock('../src/modules/storage/storage.service.js', () => ({
  storageService: {
    uploadBuffer: vi
      .fn()
      .mockResolvedValue({ storageKey: 'vault/abc123', url: 'https://cdn/abc123', bytes: 5 }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/modules/ai/ai.service.js', () => ({
  aiService: { analyzeDocument: vi.fn() },
}));

const analyzeMock = vi.mocked(aiService.analyzeDocument);
const uploadMock = vi.mocked(storageService.uploadBuffer);

async function queuedFile() {
  return FileModel.create({
    owner: new Types.ObjectId(),
    originalName: 'sample.txt',
    mimeType: 'text/plain',
    size: 11,
    status: 'QUEUED',
    progress: 5,
  });
}

describe('FR-03 background pipeline', () => {
  const statuses: string[] = [];
  let completed: unknown;

  beforeEach(() => {
    statuses.length = 0;
    completed = undefined;
    fileEvents.on('status', (e) => statuses.push(e.status));
    fileEvents.on('completed', (e) => {
      completed = e;
    });
  });

  afterEach(() => {
    fileEvents.removeAllListeners();
    vi.clearAllMocks();
  });

  it('moves QUEUED -> UPLOADING -> EXTRACTING -> ANALYZING -> COMPLETED', async () => {
    analyzeMock.mockResolvedValue({
      summary: 'A simple note',
      category: 'Notes',
      tags: ['note', 'sample', 'text'],
      model: 'test-model',
    });

    const file = await queuedFile();
    await filePipeline.run(file._id.toString(), file.owner.toString(), Buffer.from('hello world'), 'text/plain');

    const updated = await FileModel.findById(file._id).select('+extractedText');
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.progress).toBe(100);
    expect(updated?.storageKey).toBe('vault/abc123');
    expect(updated?.extractedText).toBe('hello world');
    expect(updated?.ai?.summary).toBe('A simple note');

    expect(statuses).toEqual(['UPLOADING', 'EXTRACTING', 'ANALYZING']);
    expect(uploadMock).toHaveBeenCalledOnce();
    expect(completed).toMatchObject({ fileId: file._id.toString() });
  });

  it('marks the file FAILED at the failing stage and never throws', async () => {
    analyzeMock.mockRejectedValue(new Error('Groq exploded'));

    const file = await queuedFile();

    // A pipeline failure must resolve, not reject.
    await expect(
      filePipeline.run(file._id.toString(), file.owner.toString(), Buffer.from('hello world'), 'text/plain'),
    ).resolves.toBeUndefined();

    const updated = await FileModel.findById(file._id).select('+extractedText');
    expect(updated?.status).toBe('FAILED');
    expect(updated?.failedStage).toBe('ANALYZING');
    expect(updated?.error).toBe('Groq exploded');
    // text was already persisted, which is what makes retry possible
    expect(updated?.extractedText).toBe('hello world');
  });

  it('retries analysis from stored text after an ANALYZING failure', async () => {
    analyzeMock.mockRejectedValueOnce(new Error('rate limited'));

    const file = await queuedFile();
    await filePipeline.run(file._id.toString(), file.owner.toString(), Buffer.from('hello world'), 'text/plain');

    analyzeMock.mockResolvedValueOnce({
      summary: 'Recovered',
      category: 'Technical',
      tags: ['retry', 'fixed', 'now'],
      model: 'test-model',
    });

    await filePipeline.retryAnalysis(file._id.toString(), file.owner.toString(), 'hello world');

    const updated = await FileModel.findById(file._id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.ai?.summary).toBe('Recovered');
  });
});
