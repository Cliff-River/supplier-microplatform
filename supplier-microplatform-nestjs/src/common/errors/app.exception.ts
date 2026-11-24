import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ErrorCodeValue } from './error-codes.js';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCodeValue,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }

  static unauthenticated(message = '请先登录'): AppException {
    return new AppException(
      ErrorCode.UNAUTHENTICATED,
      message,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static forbidden(message = '无权执行此操作'): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = '资源不存在'): AppException {
    return new AppException(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static invalidState(message = '当前状态不允许该操作'): AppException {
    return new AppException(
      ErrorCode.INVALID_STATE,
      message,
      HttpStatus.CONFLICT,
    );
  }

  static validation(message = '参数校验失败', details?: unknown): AppException {
    return new AppException(
      ErrorCode.VALIDATION_FAILED,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}
