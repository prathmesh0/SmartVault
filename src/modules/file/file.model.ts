import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IFile {
  owner: Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<IFile>;

const fileSchema = new Schema<IFile>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true },
);

fileSchema.index({ owner: 1, createdAt: -1 });

export const FileModel = model<IFile>('File', fileSchema);
