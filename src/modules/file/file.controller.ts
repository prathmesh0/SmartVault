import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireParam } from '../../utils/requireParam.js';
import { fileService } from './file.service.js';
import type { ListFilesFilter } from './file.types.js';

export const fileController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file || !req.fileValidation) throw ApiError.badRequest('No file provided');

    const file = await fileService.uploadFile(req.user!.id, req.file, req.fileValidation.mimeType);
    // 202: the record exists (status QUEUED) but processing hasn't
    // finished. The client should watch for socket events, not treat this
    // response as the final state.
    sendSuccess(res, { file }, { status: 202 });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const file = await fileService.getById(req.user!.id, requireParam(req, 'id'));
    sendSuccess(res, { file });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, ...filter } = req.query as unknown as ListFilesFilter & {
      page: number;
      limit: number;
    };
    const result = await fileService.list(req.user!.id, filter, page, limit);
    sendSuccess(res, { files: result.items }, { meta: result.meta });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await fileService.remove(req.user!.id, requireParam(req, 'id'));
    sendSuccess(res, { message: 'File deleted' });
  }),

  retry: asyncHandler(async (req: Request, res: Response) => {
    const file = await fileService.retry(req.user!.id, requireParam(req, 'id'));
    sendSuccess(res, { file }, { status: 202 });
  }),
};
