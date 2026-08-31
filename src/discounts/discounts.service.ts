import { Injectable } from '@nestjs/common';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { DiscountsRepository } from './discounts.repository';
import { ServiceResult } from '@/common/ServiceResult';
import { Discount } from '@/generated/prisma';

@Injectable()
export class DiscountsService {
  constructor(private readonly repo: DiscountsRepository) {}

  async create(dto: CreateDiscountDto): Promise<ServiceResult<Discount>> {
    const result = await this.repo.create(dto);
    return {
      success: true,
      message: 'Discount created successfully',
      data: result,
    };
  }

  async remove(id: number): Promise<ServiceResult<Discount>> {
    const result = await this.repo.delete(id);
    return {
      success: true,
      message: `Discount ${id} deleted successfully`,
      data: result,
    };
  }
}
