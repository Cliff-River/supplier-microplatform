import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { daysFromNow } from '../../common/utils/codes.js';
import {
  paginationMeta,
  parsePagination,
} from '../../common/utils/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InquiriesService } from '../inquiries/inquiries.service.js';
import { ProjectsService } from './projects.service.js';

const listQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  ownerId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const inquiryInputSchema = z.object({
  title: z.string().trim().min(1, '询价项标题不能为空').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.coerce.number().positive('数量必须大于 0'),
  unit: z.string().trim().min(1, '单位不能为空').max(20),
  deadline: z.coerce.date().optional(),
  invitedSupplierIds: z.array(z.string()).default([]),
  attachmentIds: z.array(z.string()).default([]),
});

const createSchema = z.object({
  name: z.string().trim().min(1, '项目名称不能为空').max(100),
  code: z.string().trim().max(40).optional(),
  customerName: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  contactName: z.string().trim().min(1, '联系人姓名不能为空').max(50),
  contactEmail: z.email('联系人邮箱格式不正确'),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  inquiry: inquiryInputSchema.optional(),
  send: z.boolean().default(false),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  customerName: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  contactName: z.string().trim().min(1).max(50).optional(),
  contactEmail: z.email('联系人邮箱格式不正确').optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
});

@Controller('projects')
@UseGuards(InternalAuthGuard)
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly inquiries: InquiriesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>,
  ) {
    const pagination = parsePagination(query);
    const where = {
      AND: [
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.ownerId ? [{ createdByUserId: query.ownerId }] : []),
        ...(query.from ? [{ createdAt: { gte: query.from } }] : []),
        ...(query.to ? [{ createdAt: { lte: query.to } }] : []),
        ...(query.keyword
          ? [
              {
                OR: [
                  {
                    name: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    code: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    customerName: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
        include: { _count: { select: { inquiries: true } } },
      }),
    ]);

    const ownerIds = [...new Set(projects.map((row) => row.createdByUserId))];
    const owners = ownerIds.length
      ? await this.prisma.internalUser.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      : [];
    const ownerMap = new Map(owners.map((row) => [row.id, row.name]));

    return {
      data: projects.map((project) => ({
        ...project,
        inquiryCount: project._count.inquiries,
        _count: undefined,
        ownerName: ownerMap.get(project.createdByUserId) ?? null,
      })),
      meta: paginationMeta(total, pagination),
    };
  }

  @Post()
  async create(
    @Body({ schema: createSchema }) body: z.infer<typeof createSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const code = body.code?.trim() || (await this.projects.generateCode());
    const exists = await this.prisma.project.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) {
      throw AppException.invalidState('项目编号已存在');
    }

    if (body.send) {
      if (!body.inquiry) {
        throw AppException.validation('请填写默认询价项后再发送');
      }
      if (!body.inquiry.invitedSupplierIds?.length) {
        throw AppException.validation('发送询价前至少选择 1 家供应商');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        code,
        name: body.name,
        customerName: body.customerName ?? null,
        description: body.description ?? null,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone ?? null,
        createdByUserId: user.id,
      },
    });

    await this.audit.record({
      action: 'project.created',
      targetType: 'project',
      targetId: project.id,
      summary: `创建项目 ${project.name}`,
      actor: user,
      request,
      afterData: { code: project.code },
    });

    let inquiry: { id: string } | null = null;
    let mailResult: { sent: number; failed: number } | null = null;

    if (body.inquiry) {
      const deadline = body.inquiry.deadline ?? daysFromNow(15);
      inquiry = await this.inquiries.createForProject(
        project.id,
        {
          ...body.inquiry,
          deadline,
        },
        user,
        request,
      );
      if (body.send) {
        mailResult = await this.inquiries.send(inquiry.id, user, request);
      }
    }

    return {
      ...(await this.projects.detail(project.id, user)),
      createdInquiryId: inquiry?.id ?? null,
      mailResult,
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: InternalAuthUser) {
    return this.projects.detail(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const project = await this.projects.getManageable(id, user);
    if (project.status === 'ARCHIVED') {
      throw AppException.invalidState('已归档项目不可编辑');
    }
    if (body.code && body.code !== project.code) {
      const exists = await this.prisma.project.findUnique({
        where: { code: body.code },
        select: { id: true },
      });
      if (exists) {
        throw AppException.invalidState('项目编号已存在');
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.customerName !== undefined
          ? { customerName: body.customerName }
          : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.contactName !== undefined
          ? { contactName: body.contactName }
          : {}),
        ...(body.contactEmail !== undefined
          ? { contactEmail: body.contactEmail }
          : {}),
        ...(body.contactPhone !== undefined
          ? { contactPhone: body.contactPhone }
          : {}),
      },
    });

    await this.audit.record({
      action: 'project.updated',
      targetType: 'project',
      targetId: id,
      summary: `更新项目 ${updated.name}`,
      actor: user,
      request,
      beforeData: { name: project.name, code: project.code },
      afterData: { name: updated.name, code: updated.code },
    });

    return this.projects.detail(id, user);
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.projects.getManageable(id, user);
    const result = await this.prisma.project.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('项目已归档或状态不允许归档');
    }
    await this.audit.record({
      action: 'project.archived',
      targetType: 'project',
      targetId: id,
      summary: '归档项目',
      actor: user,
      request,
    });
    return this.projects.detail(id, user);
  }
}
