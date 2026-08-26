import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class TransactionCustomerDto {
    @IsString()
    @IsNotEmpty()
    firstName: string

    @IsString()
    @IsOptional()
    lastName?: string

    @IsString()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    phone: string // maybe need to add to jwt token
}
