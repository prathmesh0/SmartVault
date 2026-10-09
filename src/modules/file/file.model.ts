import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export type FileStatus =
  'QUEUED' | 'UPLOADING' | 'EXTRACTING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export const ACTIVE_STATUSES: FileStatus[] = ['QUEUED', 'UPLOADING', 'EXTRACTING', 'ANALYZING'];

export interface IFileAi {
  summary: string;
  category: string;
  tags: string[];
  model: string;
  processedAt: Date;
}

export interface IFile {
  owner: Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey?: string;
  url?: string;
  extractedText?: string;
  status: FileStatus;
  progress: number;
  failedStage?: string;
  error?: string;
  ai?: IFileAi;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<IFile>;

const fileAiSchema = new Schema<IFileAi>(
  {
    summary: { type: String, required: true },
    category: { type: String, required: true },
    tags: { type: [String], required: true },
    model: { type: String, required: true },
    processedAt: { type: Date, required: true },
  },
  { _id: false },
);

const fileSchema = new Schema<IFile>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    // storageKey/url are optional now: a QUEUED file exists in Mongo
    // before Cloudinary has ever seen it.
    storageKey: { type: String },
    url: { type: String },
    extractedText: { type: String, select: false },
    status: {
      type: String,
      enum: ['QUEUED', 'UPLOADING', 'EXTRACTING', 'ANALYZING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      required: true,
      index: true,
    },
    progress: { type: Number, default: 5, min: 0, max: 100 },
    failedStage: { type: String },
    error: { type: String },
    ai: { type: fileAiSchema },
  },
  { timestamps: true },
);

// Mirror the supported listing filters so Mongo can serve them from an
// index instead of scanning every document the user owns.
fileSchema.index({ owner: 1, createdAt: -1 });
fileSchema.index({ owner: 1, status: 1 });
fileSchema.index({ owner: 1, 'ai.category': 1 });
fileSchema.index({ owner: 1, 'ai.tags': 1 });

export const FileModel = model<IFile>('File', fileSchema);
