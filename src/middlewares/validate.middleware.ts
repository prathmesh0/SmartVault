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
      // Express 5 defines req.query as a prototype getter that re-parses the
      // query string on every access and does not cache it. Mutating the
      // object it returns (or reassigning req.query) is therefore pointless —
      // the parsed/coerced values would be thrown away. Shadowing the getter
      // with an own data property is what actually sticks.
      Object.defineProperty(req, 'query', {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}
