import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { format } from 'fast-csv';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { RolesGuard } from '@/auth/guard/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { ProductReportQueryDto } from './dto/product-report-query.dto';
import {
  PagePaginationMetaDto,
  PagePaginationResponseDto,
} from '@/common/dto/response/page-pagination.response.dto';
import { Response } from 'express';


@ApiTags('reports (admin)')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.ADMIN, Role.SUPERADMIN])
@ApiBearerAuth('JwtAuthGuard')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('sales')
  getSalesReport(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getSalesReport(query);
  }

  @Get('products')
  async getProductPerformance(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getProductPerformance(query);
  }

  @Get('products/export')
  async exportProducts(
    @Query() query: SalesReportQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.getProductPerformance(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=product-report.csv',
    );

    const csvStream = format({
      headers: true, 
    });

    csvStream.pipe(res);

    result.data.forEach((row) => {
      csvStream.write(row);
    });

    csvStream.end();
  }

  @Get('sales/export')
  async exportSales(@Query() query: SalesReportQueryDto, @Res() res: Response) {
    const result = await this.reportsService.getSalesReport(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sales-report.csv',
    );

    const csvStream = format({
      headers: true,
    });

    csvStream.pipe(res);

    csvStream.write({
      totalRevenue: result.data.totalRevenue,
      orderCount: result.data.orderCount,
      avgOrderValue: result.data.avgOrderValue,
    });

    csvStream.end();
  }
}
