import { Readable } from 'node:stream';
import { cloudinary } from '../../config/cloudinary.js';
import type { UploadResult } from './storage.types.js';

export const storageService = {
  uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw', // PDFs/text aren't images — 'raw' preserves the original bytes untouched
          folder,
          unique_filename: true,
          // We deliberately do NOT pass a public_id derived from the user's
          // filename — Cloudinary generates a random one. A server-generated
          // key means a user can never control or guess another file's path.
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve({ storageKey: result.public_id, url: result.secure_url, bytes: result.bytes });
        },
      );

      // Cloudinary's SDK wants a stream, but memoryStorage gave us a Buffer.
      // Readable.from() wraps the buffer in a one-shot readable stream.
      Readable.from(buffer).pipe(uploadStream);
    });
  },

  deleteFile(storageKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(storageKey, { resource_type: 'raw' }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  },
};
