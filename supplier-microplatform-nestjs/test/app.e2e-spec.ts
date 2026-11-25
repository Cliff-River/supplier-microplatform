import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AnyAuthGuard } from '../src/common/guards/any-auth.guard.js';
import type { AuthUser } from '../src/common/types/auth-user.js';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health 返回数据库状态', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('受保护的内部接口未登录返回 401', async () => {
    await request(app.getHttpServer()).get('/dashboard/overview').expect(401);
  });

  it('供应商接口未登录返回 401', async () => {
    await request(app.getHttpServer())
      .get('/supplier/dashboard/overview')
      .expect(401);
  });

  it('文件上传未登录返回 401', async () => {
    await request(app.getHttpServer()).post('/files').expect(401);
  });
});

describe('Files (e2e, 已认证)', () => {
  let app: INestApplication;
  const user: AuthUser = {
    kind: 'INTERNAL',
    id: 'e2e-uploader',
    name: 'E2E',
    email: 'e2e@local.test',
    role: 'ADMIN',
  } as AuthUser;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AnyAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { authUser?: AuthUser } };
        }) => {
          context.switchToHttp().getRequest().authUser = user;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('拒绝白名单外的文件类型', async () => {
    const response = await request(app.getHttpServer())
      .post('/files')
      .attach('file', Buffer.from('payload'), {
        filename: 'payload.exe',
        contentType: 'application/octet-stream',
      });
    expect(response.status).toBe(415);
  });

  it('上传后可删除自己的临时附件', async () => {
    const upload = await request(app.getHttpServer())
      .post('/files')
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'contract.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(upload.body).toMatchObject({ fileName: 'contract.pdf' });
    expect(upload.body.id).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/files/${upload.body.id}`)
      .expect(200)
      .expect({ deleted: true });

    await request(app.getHttpServer())
      .delete(`/files/${upload.body.id}`)
      .expect(404);
  });
});
