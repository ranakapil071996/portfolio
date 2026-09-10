import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong. Please try again.";
    let code = "internal_error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const rec = body as Record<string, unknown>;
        const inner =
          rec.message && typeof rec.message === "object"
            ? (rec.message as Record<string, unknown>)
            : rec;
        if (Array.isArray(inner.message)) {
          message = inner.message.map(String).join(", ");
        } else if (inner.message != null) {
          message = String(inner.message);
        } else if (typeof rec.message === "string") {
          message = rec.message;
        }
        const rawCode = inner.error ?? rec.error;
        if (rawCode != null && typeof rawCode === "string" && !/^[A-Z]/.test(rawCode)) {
          code = rawCode.toLowerCase().replace(/\s+/g, "_");
        } else if (typeof rawCode === "string") {
          code = rawCode.toLowerCase().replace(/\s+/g, "_");
        }
      }
    } else if (exception instanceof Error && exception.message.startsWith("Enter ")) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
      code = "validation_error";
    } else {
      this.logger.error(
        `${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: { code, message },
    });
  }
}
