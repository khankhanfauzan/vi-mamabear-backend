import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma';
import { startOfDay, endOfDay } from '@/common/utils/date.util';
import { Injectable } from '@nestjs/common';
import {
  AdminActivityLogQueryDto,
  ActivityLogSortBy,
  ActivityLogSortOrder,
} from './dto/admin-activity-log-query.dto';

@Injectable()
export class AdminActivityLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { userId: string; action: string; entity: string; entityId: string | null }) {
    return this.prisma.adminActivityLog.create({ data });
  }

  findByUserId(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    return this.prisma.adminActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async findAll(query: AdminActivityLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AdminActivityLogWhereInput = {};

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.entity) {
      where.entity = { contains: query.entity, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = startOfDay(query.startDate);
      if (query.endDate) where.createdAt.lte = endOfDay(query.endDate);
    }

    const dir = query.sortOrder === ActivityLogSortOrder.ASC ? 'asc' : 'desc';

    let orderBy: Prisma.AdminActivityLogOrderByWithRelationInput;
    switch (query.sortBy) {
      case ActivityLogSortBy.ACTION:
        orderBy = { action: dir };
        break;
      case ActivityLogSortBy.ENTITY:
        orderBy = { entity: dir };
        break;
      default:
        orderBy = { createdAt: dir };
        break;
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.adminActivityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.adminActivityLog.count({ where }),
    ]);

    return { items, totalItems };
  }
}
