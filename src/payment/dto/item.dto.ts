import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator"

export class TransactionItemDto {
    @IsString()
    @IsNotEmpty()
    slug: string // slug

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    price: number

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    quantity: number

    @IsString()
    @IsNotEmpty()
    name: string
}
