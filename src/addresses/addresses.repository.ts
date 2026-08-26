import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAddressById(id: number) {
    return this.prisma.address.findUnique({ where: { id } });
  }

  async findAddressesByUserId(userId: string) {
    return this.prisma.address.findMany({ where: { userId } });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const completeAddress =
      `${dto.road}, ${dto.subdistrictName}, ${dto.districtName}, ` +
      `${dto.cityName}, ${dto.postalCode} - ${dto.provinceName}` +
      (dto.detail ? ` | Note: ${dto.detail}` : '');

    const data = { ...dto, userId, completeAddress };
    return this.prisma.address.create({ data });
  }

  async updateAddress(userId: string, id: number, dto: UpdateAddressDto) {
    const completeAddress = `${dto.road}, ${dto.subdistrictName}, ${dto.districtName}, ${dto.cityName}, ${dto.postalCode} - ${dto.provinceName} | Note: ${dto.detail}`;
    const data = { ...dto, userId, completeAddress };
    return this.prisma.address.update({ where: { id }, data });
  }

  async deleteAddress(id: number) {
    return this.prisma.address.delete({ where: { id } });
  }
}
