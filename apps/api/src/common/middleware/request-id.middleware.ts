import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Attaches the correlation `requestId` to every request.
 *
 * This is a MIDDLEWARE (not an interceptor) on purpose: Nest runs
 * middleware → guards → interceptors, so errors thrown by guards
 * (401/403) now carry a requestId too — previously they returned
 * `requestId: null` because the old interceptor ran after the guards
 * (ADR-0003, production checklist Gate 2 item 8).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string | undefined) ?? uuidv4();
  (req as any)["requestId"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
