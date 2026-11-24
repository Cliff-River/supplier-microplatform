import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode, type ErrorCodeValue } from '../errors/error-codes.js';

interface PrismaLikeError {
  code?: string;
  meta?: { target?: string[] | string };
}

const STATUS_CODE_MAP: Record<number, ErrorCodeValue> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.INVALID_STATE,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.FILE_TOO_LARGE,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCodeValue = ErrorCode.INTERNAL_ERROR;
    let message = '服务器内部错误';
    let details: unknown = null;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details ?? null;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCode.VALIDATION_FAILED;
      message = '参数校验失败';
      details = exception.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODE_MAP[status] ?? ErrorCode.INTERNAL_ERROR;
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const data = payload as { message?: string | string[]; error?: string };
        message = Array.isArray(data.message)
          ? data.message.join('；')
          : (data.message ?? exception.message);
        if (status === HttpStatus.BAD_REQUEST) {
          details = data.message ?? null;
        }
      }
    } else {
      const prismaError = exception as PrismaLikeError;
      if (prismaError?.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = prismaError.meta?.target;
        const field = Array.isArray(target) ? target[0] : target;
        if (field === 'username') {
          code = ErrorCode.DUPLICATE_USERNAME;
          message = '用户名已存在';
        } else if (field === 'email') {
          code = ErrorCode.DUPLICATE_EMAIL;
          message = '邮箱已存在';
        } else {
          code = ErrorCode.INVALID_STATE;
          message = '数据已存在，请勿重复提交';
        }
      } else {
        this.logger.error(
          exception instanceof Error ? exception.stack : String(exception),
        );
      }
    }

    const requestId =
      request.requestId ?? `req_${Math.random().toString(36).slice(2, 12)}`;

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
      requestId,
    });
  }
}
