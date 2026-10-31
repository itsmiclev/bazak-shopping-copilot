import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { StorageError } from "@bazak/storage";
import type { ApiError } from "@bazak/shared";
import type { Response } from "express";
import { ConversationError } from "../domain/conversation.error.js";

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.destroyed || response.headersSent) return;
    const failure = this.describe(error);
    response
      .status(failure.status)
      .json({ error: failure.message } satisfies ApiError);
  }
  private describe(error: unknown): { status: number; message: string } {
    if (error instanceof StorageError)
      return {
        status:
          error.code === "NOT_FOUND"
            ? 404
            : error.code === "INVALID_CURSOR"
              ? 400
              : 507,
        message: error.message,
      };
    if (error instanceof ConversationError)
      return {
        status: { BUSY: 409, RATE_LIMITED: 429, UNAVAILABLE: 503 }[error.code],
        message: error.message,
      };
    if (error instanceof HttpException)
      return { status: error.getStatus(), message: error.message };
    const bodyError = error as { type?: string } | undefined;
    if (bodyError?.type === "entity.too.large")
      return { status: 413, message: "Request is too large." };
    if (bodyError?.type === "entity.parse.failed")
      return { status: 400, message: "Invalid JSON request." };
    return { status: 500, message: "The request could not be completed." };
  }
}
