import { Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsRepository } from './reports.repository';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { ServiceResult } from '@/common/ServiceResult';

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  async getDashboard(): Promise<ServiceResult<any>> {
    const [
      getOrderCount,
      getCustomerCount,
      getProductCount,
      getRecentOrder,
      getLowStockProducts,
      getTopSellingProducts,
      getRevenueOrders,
    ] = await Promise.all([
      this.repo.getOrderCount(),
      this.repo.getCustomerCount(),
      this.repo.getProductCount(),
      this.repo.getRecentOrder(),
      this.repo.getLowStockProducts(),
      this.repo.getTopSellingProducts(),
      this.repo.getRevenueOrders(),
    ]);

    const totalRevenue = getRevenueOrders.reduce(
      (sum, order) =>
        sum + order.subtotalIdr + order.taxIdr + order.shippingCostIdr,
      0,
    );

    return {
      success: true,
      message: `Dashboard`,
      data: {
        getRevenueOrders,
        totalRevenue,
        getOrderCount,
        getCustomerCount,
        getProductCount,
        getRecentOrder,
        getLowStockProducts,
        getTopSellingProducts,
      },
    };
  }

  async getSalesReport(
    query: SalesReportQueryDto,
  ): Promise<ServiceResult<any>> {
    const orders = await this.repo.getSalesOrders(query);

    let totalRevenue = 0;

    for (const order of orders) {
      for (const item of order.orderItems) {
        totalRevenue += Number(item.price) * item.quantity;
      }
    }

    const orderCount = orders.length;

    const avgOrderValue =
      orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

    const trendMap = new Map();

    for (const order of orders) {
      let revenue = 0;

      for (const item of order.orderItems) {
        revenue += Number(item.price) * item.quantity;
      }

      let key = '';

      switch (query.period) {
        case 'weekly':
          key = this.getWeekKey(order.createdAt);
          break;

        case 'monthly':
          key =
            order.createdAt.getFullYear() +
            '-' +
            String(order.createdAt.getMonth() + 1).padStart(2, '0');
          break;

        default:
          key = order.createdAt.toISOString().split('T')[0];
      }

      if (!trendMap.has(key)) {
        trendMap.set(key, {
          period: key,
          revenue: 0,
          orders: 0,
        });
      }

      trendMap.get(key).revenue += revenue;
      trendMap.get(key).orders += 1;
    }

    const productMap = new Map();

    for (const order of orders) {
      for (const item of order.orderItems) {
        const id = item.productId;

        if (!productMap.has(id)) {
          productMap.set(id, {
            productId: id,
            productName: item.product.name,
            quantitySold: 0,
            revenue: 0,
          });
        }

        const current = productMap.get(id);

        current.quantitySold += item.quantity;

        current.revenue += Number(item.price) * item.quantity;
      }
    }

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    return {
      success: true,
      message: `Sales Report`,
      data: {
        totalRevenue,
        orderCount,
        avgOrderValue,
        trends: [...trendMap.values()],
        topProducts,
      },
    };
  }

  async getProductPerformance(
    query: SalesReportQueryDto,
  ): Promise<ServiceResult<any>> {
    const items = await this.repo.getProductPerformance(query);

    const productMap = new Map();

    for (const item of items) {
      const key = item.variantId;

      if (!productMap.has(key)) {
        productMap.set(key, {
          Product: item.product.name,
          Variant: item.variant.name,
          sku: item.variant.sku ?? '-',

          category: item.product.category?.name ?? '-',

          salesCount: 0,
          revenue: 0,
        });
      }

      const current = productMap.get(key);

      current.salesCount += item.quantity;

      current.revenue += Number(item.price) * item.quantity;
    }

    return {
      success: true,
      message: 'Product Performance Report',
      data: [...productMap.values()],
    };
  }

  private getWeekKey(date: Date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);

    const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);

    const week = Math.ceil((days + firstDay.getDay() + 1) / 7);

    return `${date.getFullYear()}-W${week}`;
  }
}
