import type { ErrorRequestHandler } from "express";
import { ValidateError } from "tsoa";

import { AppError } from "../lib/error";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ValidateError) {
    res.status(400).json({ message: "Request validation failed", details: error.fields });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({ message: "Internal server error" });
};
