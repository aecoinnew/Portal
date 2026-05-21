import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "Route not found", "not_found"));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as unknown as { requestId?: string }).requestId ?? null;
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Invalid request payload",
        code: "validation_error",
        details: error.flatten()
      }
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    });
  }

  // Structured log for unhandled errors. Single-line JSON for log shippers.
  // Do NOT include req body - it may contain credentials.
  const err = error as { message?: string; stack?: string; name?: string };
  const logEntry = {
    level: "error",
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.originalUrl,
    code: "internal_error",
    name: err?.name ?? "Error",
    message: err?.message ?? "unknown",
    stack: err?.stack ?? null
  };
  console.error(JSON.stringify(logEntry));
  return res.status(500).json({
    error: {
      message: "Internal server error",
      code: "internal_error"
    }
  });
}
