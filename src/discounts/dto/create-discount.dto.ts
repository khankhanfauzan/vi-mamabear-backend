import { IsNotEmpty, IsNumber, Min, Max, IsDateString, IsOptional, IsBoolean, ValidateIf } from "class-validator"
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiscountDto {
    @ApiProperty({ example: 1 })
    @IsNumber()
    @IsOptional()
    variantId?: number 

    @ApiPropertyOptional({ example: true })
    @IsBoolean()
    @IsOptional()
    isPercent?: boolean

    @ApiProperty({ example: 15000 })
    @IsNumber()
    @IsNotEmpty()
    @ValidateIf(o => o.isPercent)
    @Min(1)
    @Max(100)
    amount: number

    @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
    @IsDateString()
    @IsOptional()
    startedAt?: string

    @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
    @IsDateString()
    @IsNotEmpty()
    endsAt: string 
}
