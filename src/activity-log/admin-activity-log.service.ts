import { Injectable } from '@nestjs/common';
import { AdminActivityLogRepository } from './admin-activity-log.repository';
import { AdminActivityLogQueryDto } from './dto/admin-activity-log-query.dto';
import {
  PagePaginationMetaDto,
  PagePaginationResponseDto,
} from '@/common/dto/response/page-pagination.response.dto';
import { ServiceResult } from '@/common/ServiceResult';

@Injectable()
export class AdminActivityLogService {
  constructor(
    private readonly adminActivityLogRepository: AdminActivityLogRepository,
  ) {}

  async log(
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
  ) {
    try {
      return await this.adminActivityLogRepository.create({
        userId,
        action,
        entity,
        entityId: entityId ?? null,
      });
    } catch {
      // Activity logging is best-effort; never crash the main request
    }
  }

  async findAll(query: AdminActivityLogQueryDto): Promise<ServiceResult<PagePaginationResponseDto<any>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, totalItems } = await this.adminActivityLogRepository.findAll(query);
    const meta = new PagePaginationMetaDto(page, limit, totalItems);
    const result = new PagePaginationResponseDto(items, meta);
    return {
      success: true,
      message: `Returned ${items.length} activity logs (page ${page} of ${meta.totalPages})`,
      data: result,
    };
  }
}
