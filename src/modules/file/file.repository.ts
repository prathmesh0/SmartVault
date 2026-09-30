import { FileModel, type FileDocument } from './file.model.js';

interface CreateFileData {
  owner: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
}

export const fileRepository = {
  create(data: CreateFileData): Promise<FileDocument> {
    return FileModel.create(data);
  },

  findByIdAndOwner(id: string, owner: string): Promise<FileDocument | null> {
    return FileModel.findOne({ _id: id, owner });
  },
  async listByOwner(
    owner: string,
    page: number,
    limit: number,
  ): Promise<{ items: FileDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      FileModel.find({ owner }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FileModel.countDocuments({ owner }),
    ]);
    return { items, total };
  },
  deleteByIdAndOwner(id: string, owner: string): Promise<FileDocument | null> {
    return FileModel.findOneAndDelete({ _id: id, owner });
  },
};
