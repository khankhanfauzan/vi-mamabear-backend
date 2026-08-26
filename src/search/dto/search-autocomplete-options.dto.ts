import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Min } from "class-validator";

export class SearchAutocompleteOptionsDto {
    @ApiPropertyOptional({ description: "Limit autocomplete results" })
    @IsNumber()
    @IsOptional()
    @Min(1)
    limit?: number

    @ApiPropertyOptional({ description: "Minimum chars in search in order to query database" })
    @IsNumber()
    @IsOptional()
    @Min(0)
    minChars?: number

    @ApiPropertyOptional({ description: "Similarity threshold in trigram search for fuzzy matching" })
    @IsNumber()
    @IsOptional()
    @Min(0)
    similarityThreshold?: number
}
