import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { INTERNAL_AUTH, SUPPLIER_AUTH } from './auth/auth.tokens.js';
import type { InternalAuth, SupplierAuth } from './auth/auth.tokens.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  expressApp.use(
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      const requestId = request.header('x-request-id') ?? randomUUID();
      (request as express.Request & { requestId: string }).requestId =
        requestId;
      response.setHeader('x-request-id', requestId);
      next();
    },
  );

  const internalAuth = app.get<InternalAuth>(INTERNAL_AUTH);
  const supplierAuth = app.get<SupplierAuth>(SUPPLIER_AUTH);

  // Better Auth 需要原始请求体，必须在 express.json 之前挂载。
  // 平台不提供公开注册：两套体系均拦截 sign-up 路由，账号仅由内部管理员创建。
  // 同时对登录、找回密码、重置密码做进程内限流（Nest 限流器覆盖不到 Better Auth 路由）。
  const authRateLimitWindowMs = 60_000;
  const authRateLimitMax = 10;
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  expressApp.use(
    ['/api/auth/internal', '/api/auth/supplier'],
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      if (request.originalUrl.includes('/sign-up')) {
        response.status(404).json({ code: 'NOT_FOUND', message: 'Not Found' });
        return;
      }

      const limited =
        /sign-in|request-password-reset|reset-password|forget-password/.test(
          request.originalUrl,
        );
      if (!limited) {
        next();
        return;
      }

      const key = `${request.ip ?? 'unknown'}:${request.originalUrl.split('?')[0]}`;
      const now = Date.now();
      const entry = authAttempts.get(key);
      if (!entry || entry.resetAt <= now) {
        authAttempts.set(key, {
          count: 1,
          resetAt: now + authRateLimitWindowMs,
        });
        next();
        return;
      }
      if (entry.count >= authRateLimitMax) {
        response.status(429).json({
          code: 'TOO_MANY_REQUESTS',
          message: '请求过于频繁，请稍后再试',
        });
        return;
      }
      entry.count += 1;
      next();
    },
  );
  expressApp.all(
    '/api/auth/internal/{*splat}',
    toNodeHandler(internalAuth as never),
  );
  expressApp.all(
    '/api/auth/supplier/{*splat}',
    toNodeHandler(supplierAuth as never),
  );

  // 测试发信接口限流，避免被用于邮件轰炸。
  const mailTestWindowMs = 60_000;
  const mailTestMax = 5;
  const mailTestAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  expressApp.use(
    '/api/admin/mail/test',
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      const key = request.ip ?? 'unknown';
      const now = Date.now();
      const entry = mailTestAttempts.get(key);
      if (!entry || entry.resetAt <= now) {
        mailTestAttempts.set(key, {
          count: 1,
          resetAt: now + mailTestWindowMs,
        });
        next();
        return;
      }
      if (entry.count >= mailTestMax) {
        response.status(429).json({
          code: 'TOO_MANY_REQUESTS',
          message: '请求过于频繁，请稍后再试',
        });
        return;
      }
      entry.count += 1;
      next();
    },
  );

  expressApp.use(express.json({ limit: '2mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '2mb' }));

  await app.listen(env.PORT);
  console.log(
    `API 已启动: http://localhost:${env.PORT}/api（环境: ${env.NODE_ENV}）`,
  );
}

await bootstrap();
