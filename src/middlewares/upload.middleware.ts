import { extname } from 'node:path';
import multer from 'multer';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { detectAndValidateFileType } from '../utils/fileSignature.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt']);

export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req: Request, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(ApiError.unsupportedMediaType(`File extension "${ext}" is not allowed`));
      return;
    }
    cb(null, true);
  },
}).single('file');

export const verifyFileSignature = asyncHandler(async (req, _res, next) => {
  if (!req.file) throw ApiError.badRequest('No file provided');

  const result = await detectAndValidateFileType(req.file.buffer);
  req.fileValidation = result;
  next();
});
