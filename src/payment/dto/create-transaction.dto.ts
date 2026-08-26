import { IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateTransactionDto {
    @ApiProperty({ example: '019ed09f-53a3-747a-9e1b-ba55269d9e23' })
    @IsString()
    @IsNotEmpty()
    orderId: string
}
