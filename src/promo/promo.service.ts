import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPromoDto: CreatePromoDto) {
    return this.prisma.promoCode.create({
      data: {
        ...createPromoDto,
        code: createPromoDto.code.toUpperCase(),
      },
    });
  }

  async findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });
    if (!promo) {
      throw new NotFoundException(`Promo dengan ID ${id} tidak ditemukan`);
    }
    return promo;
  }

  async update(id: number, updatePromoDto: UpdatePromoDto) {
    await this.findOne(id);
    return this.prisma.promoCode.update({
      where: { id },
      data: updatePromoDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.promoCode.delete({
      where: { id },
    });
  }

  async validatePromoCode(code: string, userId: string, subtotalIdr: number) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo) {
      throw new NotFoundException('Kode promo tidak ditemukan');
    }

    if (!promo.isActive) {
      throw new BadRequestException('Kode promo sudah tidak aktif');
    }

    const now = new Date();
    if (now < promo.startedAt) {
      throw new BadRequestException('Kode promo belum berlaku');
    }

    if (now > promo.expiresAt) {
      throw new BadRequestException('Kode promo sudah kedaluwarsa');
    }

    if (subtotalIdr < promo.minSpendIdr) {
      throw new BadRequestException(`Minimal belanja untuk promo ini adalah Rp ${promo.minSpendIdr.toLocaleString('id-ID')}`);
    }

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new BadRequestException('Kuota penggunaan promo sudah habis');
    }

    const userUsageCount = await this.prisma.promoUsage.count({
      where: {
        promoCodeId: promo.id,
        userId: userId,
      },
    });

    if (userUsageCount >= promo.maxUsagePerUser) {
      throw new BadRequestException(`Anda sudah menggunakan kode promo ini sebanyak batas maksimum (${promo.maxUsagePerUser} kali)`);
    }

    return promo;
  }
}
