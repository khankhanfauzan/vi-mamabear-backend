import { IsNotEmpty, IsNumber, IsString } from "class-validator";


export class PatchCourierDto {
    @IsNumber()
    @IsNotEmpty()
    shippingCostIdr: number;

    @IsString()
    @IsNotEmpty()
    courierName:     string;

    @IsString()
    @IsNotEmpty()
    courierCode:     string;

    @IsString()
    @IsNotEmpty()
    shippingMethod:  string;
}
