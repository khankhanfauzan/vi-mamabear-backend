import { IsArray, IsBoolean, IsNumber } from 'class-validator';

export class BulkUpdateProductsStatusDto {
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];

  @IsBoolean()
  isActive: boolean;
}
