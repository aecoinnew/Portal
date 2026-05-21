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

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
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

  console.error(error);
  return res.status(500).json({
    error: {
      message: "Internal server error",
      code: "internal_error"
    }
  });
}
