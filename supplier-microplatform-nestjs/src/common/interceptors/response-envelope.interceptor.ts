import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { StreamableFile } from '@nestjs/common';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | StreamableFile>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | StreamableFile> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>)
        ) {
          return data as unknown as ApiResponse<T>;
        }
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as Record<string, unknown>) &&
          'meta' in (data as Record<string, unknown>)
        ) {
          const paginated = data as unknown as {
            data: T;
            meta: Record<string, unknown>;
          };
          return { success: true, data: paginated.data, meta: paginated.meta };
        }
        response.setHeader('X-Content-Type-Options', 'nosniff');
        return { success: true, data };
      }),
    );
  }
}
