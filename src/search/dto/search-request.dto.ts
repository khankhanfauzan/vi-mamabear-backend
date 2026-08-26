import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';


export class SearchRequestDto  {
    @ApiPropertyOptional({ description: "Text search query" })
    @IsString()
    @IsNotEmpty()
    q: string;

    @ApiPropertyOptional({ description: 'Pagination cursor (product id)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    cursor?: number;

    @ApiPropertyOptional({ description: 'Number of results to return', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
}

