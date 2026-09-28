import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncController): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
