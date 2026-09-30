import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);

    if (schemas.query) {
      const parsed = schemas.query.parse(req.query);
      // req.query is a getter-only property in Express 5 — reassigning it
      // throws, so we mutate the existing object in place instead.
      Object.assign(req.query, parsed);
    }

    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}
