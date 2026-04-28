import type { Request, Response, NextFunction } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { getRequestBaseLanguage } from '../../utils/requestLanguage';
import { messageFor } from '../../i18n/apiMessages';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const lang = getRequestBaseLanguage(req);
      return res.status(400).json({
        success: false,
        error: messageFor('VALIDATION_FAILED', lang),
        code: 'VALIDATION_ERROR',
        details: formatZod(parsed.error),
      });
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const lang = getRequestBaseLanguage(req);
      return res.status(400).json({
        success: false,
        error: messageFor('VALIDATION_FAILED', lang),
        code: 'VALIDATION_ERROR',
        details: formatZod(parsed.error),
      });
    }
    (req as any).validatedQuery = parsed.data;
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      const lang = getRequestBaseLanguage(req);
      return res.status(400).json({
        success: false,
        error: messageFor('VALIDATION_FAILED', lang),
        code: 'VALIDATION_ERROR',
        details: formatZod(parsed.error),
      });
    }
    (req as any).validatedParams = parsed.data;
    next();
  };
}

function formatZod(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
