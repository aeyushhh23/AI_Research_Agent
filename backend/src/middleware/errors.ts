import type { NextFunction, Request, Response } from "express";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found." });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  const statusCode =
    typeof err === "object" && err !== null && "statusCode" in err && typeof err.statusCode === "number"
      ? err.statusCode
      : 500;
  const details = typeof err === "object" && err !== null && "details" in err ? err.details : undefined;
  res.status(statusCode).json({ error: message, details });
}
