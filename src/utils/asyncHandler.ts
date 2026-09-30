import type { NextFunction, Request, RequestHandler, Response } from 'express';

// P (route params) and Q (query) stay generic so each controller can declare
// the shape it validated, and the wrapper hands that shape to Express intact.
type AsyncController<P, Q> = (
  req: Request<P, any, any, Q>,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  <P, Q>(fn: AsyncController<P, Q>): RequestHandler<P, any, any, Q> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
