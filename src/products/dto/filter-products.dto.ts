import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

enum SortDirection {
    DESCENDING,
    ASCENDING,
}

export class FilterProductsDto {
    @ApiPropertyOptional({ description: "Include category (returns all categories if not selected)" })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    categories?: string[];

    @ApiPropertyOptional({ description: "Include highlight (returns all highlights if not selected)" })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    highlights?: string[];

    @ApiPropertyOptional({ description: "Minimum price of product" })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ description: "Maximum price of product" })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({ description: "Return only products in stock" })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    inStock?: boolean;

    @ApiPropertyOptional({ description: "Sort price ascending" })
    @IsEnum(SortDirection)
    @IsOptional()
    @Type(() => Number)
    priceAscending?: SortDirection;

    @ApiPropertyOptional({ description: "Sort creation date ascending" })
    @IsEnum(SortDirection)
    @IsOptional()
    @Type(() => Number)
    creationDateAscending?: SortDirection;

    @ApiPropertyOptional({ description: "(TODO) Sort popularity date ascending" })
    @IsEnum(SortDirection)
    @IsOptional()
    @Type(() => Number)
    popularAscending?: SortDirection;

    @ApiPropertyOptional({ description: "(TODO) Sort rating date ascending" })
    @IsEnum(SortDirection)
    @IsOptional()
    @Type(() => Number)
    ratingAscending?: SortDirection;

    @ApiPropertyOptional({ description: 'Fuzzy search by name, slug, or description' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: 'Minimum similarity threshold for fuzzy search (0-1)', default: 0.05 })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    @Max(1)
    similarityThreshold?: number;

    @ApiPropertyOptional({ description: "Pagination cursor (base64-encoded)" })
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ description: "Number of rows to fetch" })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    @Min(1)
    @Max(50)
    limit?: number;
}
