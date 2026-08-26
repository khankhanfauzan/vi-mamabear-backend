import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  AdminCustomersQueryDto,
  CustomerSortBy,
  CustomerSortOrder,
} from './dto/admin-customers-query.dto';
import {
  AdminUsersQueryDto,
  AdminUsersSortBy,
  AdminUsersSortOrder,
} from './dto/admin-users-query.dto';
import { PinoLogger } from 'pino-nestjs';
import { Role } from '@/generated/prisma';

export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isBlocked: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
};

export type AdminCustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: string | number;
  totalSpent: string | number;
  registeredAt: Date;
};

@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {}

  create(data: CreateUserDto) {
    const { password, ...rest } = data;
    return this.prisma.user.create({
      data: { ...rest, hashedPassword: password },
      select: USER_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: USER_SELECT });
  }


  async aggregateCustomerOrders(userId: string) {
    return this.prisma.order.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: {
        subtotalIdr: true,
        taxIdr: true,
        shippingCostIdr: true,
      },
      _max: { createdAt: true },
    });
  }

  async findCustomerOrderHistory(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        subtotalIdr: true,
        taxIdr: true,
        shippingCostIdr: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10,
    });

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      subtotalIdr: Number(order.subtotalIdr),
      taxIdr: Number(order.taxIdr),
      shippingCostIdr: Number(order.shippingCostIdr),
      totalAmount:
        Number(order.subtotalIdr) +
        Number(order.taxIdr) +
        Number(order.shippingCostIdr),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }

  async aggregateForUserIds(userIds: string[]) {
    if (!userIds || userIds.length === 0) return [];

    const groups = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { id: true },
      _sum: { subtotalIdr: true, taxIdr: true, shippingCostIdr: true },
      _max: { createdAt: true },
    });

    return groups.map((g) => ({
      userId: g.userId,
      totalOrders: Number(g._count?.id ?? 0),
      totalSpent:
        Number(g._sum?.subtotalIdr ?? 0) +
        Number(g._sum?.taxIdr ?? 0) +
        Number(g._sum?.shippingCostIdr ?? 0),
      averageOrderValue:
        (Number(g._sum?.subtotalIdr ?? 0) +
          Number(g._sum?.taxIdr ?? 0) +
          Number(g._sum?.shippingCostIdr ?? 0)) /
        (Number(g._count?.id ?? 0) || 1),
      lastOrderDate: g._max?.createdAt ?? null,
    }));
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT,
    });
  }

  update(id: string, data: UpdateUserDto) {
    const updateData: Record<string, unknown> = { ...data };
    if ('password' in data && data.password !== undefined) {
      delete updateData.password;
      updateData.hashedPassword = data.password;
    }
    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  }

  setBlocked(id: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
      select: USER_SELECT,
    });
  }

  countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: Role.SUPERADMIN, isBlocked: false },
    });
  }

  delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: USER_SELECT,
    });
  }

  async findCustomers(query: AdminCustomersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const params: any[] = [];

    const whereParts: string[] = [`WHERE u.role = 'USER'`];

    if (query.search) {
      const p = params.length + 1;
      params.push(`%${query.search}%`);
      whereParts.push(
        `AND (u.name ILIKE $${p} OR u.email ILIKE $${p} OR u.phone ILIKE $${p})`,
      );
    }

    if (query.isVerified !== undefined) {
      const p = params.length + 1;
      params.push(query.isVerified);
      whereParts.push(`AND u."isVerified" = $${p}`);
    }

    const dir = query.sortOrder === CustomerSortOrder.ASC ? 'ASC' : 'DESC';

    let orderByClause: string;
    switch (query.sortBy) {
      case CustomerSortBy.NAME:
        orderByClause = `u.name ${dir}`;
        break;
      case CustomerSortBy.EMAIL:
        orderByClause = `u.email ${dir}`;
        break;
      case CustomerSortBy.TOTAL_SPENT:
        orderByClause = `COALESCE(SUM(o."subtotalIdr" + o."shippingCostIdr"), 0) ${dir}`;
        break;
      case CustomerSortBy.TOTAL_ORDERS:
        orderByClause = `COUNT(o.id) ${dir}`;
        break;
      default:
        orderByClause = `u."createdAt" ${dir}`;
        break;
    }

    const offsetParam = params.length + 1;
    const limitParam = params.length + 2;
    params.push(offset, limit);

    const rawQuery = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.role,
        u."isVerified",
        u."createdAt",
        u."updatedAt",
        COUNT(o.id) AS "totalOrders",
        COALESCE(SUM(o."subtotalIdr" + o."shippingCostIdr"), 0) AS "totalSpent",
        COALESCE(
          AVG(o."subtotalIdr" + o."shippingCostIdr")::numeric(12,2),
          0
        ) AS "averageOrderValue",
        MAX(o."createdAt") AS "lastOrderDate"
      FROM "User" u
      LEFT JOIN "Order" o ON o."userId" = u.id
      ${whereParts.join(' ')}
      GROUP BY u.id
      ORDER BY ${orderByClause}, u.id ASC
      OFFSET $${offsetParam}
      LIMIT $${limitParam}
    `;

    const countQuery = `
      SELECT COUNT(*) AS "totalCount"
      FROM "User" u
      ${whereParts.join(' ')}
    `;

    this.logger.info(`findCustomers query: ${rawQuery}`);

    const rows: any[] = await this.prisma.$queryRawUnsafe(rawQuery, ...params);
    const countRows: any[] = await this.prisma.$queryRawUnsafe(
      countQuery,
      ...params.slice(0, -2),
    );

    const totalItems = Number(countRows[0]?.totalCount ?? 0);

    const items = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role,
      isVerified: row.isVerified,
      registeredAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalOrders: Number(row.totalOrders),
      totalSpent: Number(row.totalSpent),
      averageOrderValue: Number(row.averageOrderValue),
      lastOrderDate: row.lastOrderDate ?? null,
    }));

    return { items, totalItems };
  }

  async findCustomerDetail(id: string) {
    const user = this.prisma.user.findFirst({
      where: {
        id,
        role: Role.USER,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ...USER_SELECT,
        orders: {
          select: {
            id: true,
            status: true,
            subtotalIdr: true,
            shippingCostIdr: true,
            createdAt: true,
          },
        },
        address: {
          select: {
            id: true,
            name: true,
            phone: true,
            provinceName: true,
            cityName: true,
            districtName: true,
            subdistrictName: true,
            postalCode: true,
            road: true,
            completeAddress: true,
            detail: true,
            usedFor: true,
          },
        },
      },
    });

    if (!user) return null;

    const orderStats = await this.prisma.order.aggregate({
      where: { userId: id },
      _count: { id: true },
      _sum: { subtotalIdr: true, shippingCostIdr: true },
      _max: { createdAt: true },
    });

    const totalOrders = orderStats._count.id;
    const totalSpent =
      (orderStats._sum.subtotalIdr ?? 0) +
      (orderStats._sum.shippingCostIdr ?? 0);
    const averageOrderValue =
      totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;

    return {
      ...user,
      totalOrders,
      totalSpent,
      averageOrderValue,
      lastOrderDate: orderStats._max.createdAt ?? null,
    };
  }

  async findAdminUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.role) {
      where.role = query.role;
    } else {
      where.role = { in: ['ADMIN', 'SUPERADMIN'] };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }

    const dir = query.sortOrder === AdminUsersSortOrder.ASC ? 'asc' : 'desc';

    let orderBy: any;
    switch (query.sortBy) {
      case AdminUsersSortBy.NAME:
        orderBy = { name: dir };
        break;
      case AdminUsersSortBy.EMAIL:
        orderBy = { email: dir };
        break;
      default:
        orderBy = { createdAt: dir };
        break;
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, totalItems };
  }

  async exportCustomers(query: AdminCustomersQueryDto) {
    const params: any[] = [];
    const whereParts: string[] = [`WHERE u.role = 'USER'`];

    if (query.search) {
      const p = params.length + 1;
      params.push(`%${query.search}%`);
      whereParts.push(
        `AND (u.name ILIKE $${p} OR u.email ILIKE $${p} OR u.phone ILIKE $${p})`,
      );
    }

    if (query.isVerified !== undefined) {
      const p = params.length + 1;
      params.push(query.isVerified);
      whereParts.push(`AND u."isVerified" = $${p}`);
    }

    const rawQuery = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.role,
        u."isVerified",
        u."createdAt",
        u."updatedAt",
        COUNT(o.id) AS "totalOrders",
        COALESCE(SUM(o."subtotalIdr" + o."shippingCostIdr"), 0) AS "totalSpent",
        COALESCE(
          AVG(o."subtotalIdr" + o."shippingCostIdr")::numeric(12,2),
          0
        ) AS "averageOrderValue",
        MAX(o."createdAt") AS "lastOrderDate"
      FROM "User" u
      LEFT JOIN "Order" o ON o."userId" = u.id
      ${whereParts.join(' ')}
      GROUP BY u.id
      ORDER BY u."createdAt" DESC
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(rawQuery, ...params);

    return rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role,
      isVerified: row.isVerified,
      registeredAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalOrders: Number(row.totalOrders),
      totalSpent: Number(row.totalSpent),
      averageOrderValue: Number(row.averageOrderValue),
      lastOrderDate: row.lastOrderDate ?? null,
    }));
  }
}
