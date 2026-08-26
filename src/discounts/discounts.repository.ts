import { PrismaService } from "@/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateDiscountDto } from "./dto/create-discount.dto";

@Injectable()
export class DiscountsRepository {
    constructor(private readonly prisma: PrismaService) {}
    create(dto: CreateDiscountDto) {
        const { variantId, ...data} = dto;
        return this.prisma.discount.create({
            data: { ...data, variant: { connect: { id: variantId } }}
        })
    }
    delete(id: number) {
        return this.prisma.discount.delete({
            where: { id },
        })
    }

}
