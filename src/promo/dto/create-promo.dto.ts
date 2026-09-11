import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { PromoDiscountType } from '../../generated/prisma';

export class CreatePromoDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PromoDiscountType)
  discountType: PromoDiscountType;

  @IsNumber()
  discountValue: number;

  @IsNumber()
  @IsOptional()
  minSpendIdr?: number;

  @IsNumber()
  @IsOptional()
  maxDiscountIdr?: number;

  @IsNumber()
  @IsOptional()
  maxShippingDiscountIdr?: number;

  @IsNumber()
  @IsOptional()
  usageLimit?: number;

  @IsNumber()
  @IsOptional()
  maxUsagePerUser?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startedAt?: string;

  @IsDateString()
  expiresAt: string;
}
