import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ImageCreateInput) {
    return this.prisma.image.create({
      data,
    });
  }

  createMany(data: Prisma.ImageCreateManyInput[]) {
    return this.prisma.image.createMany({
      data,
    });
  }

  delete(where: Prisma.ImageWhereUniqueInput) {
    return this.prisma.image.delete({ where });
  }

  findAll() {
    return this.prisma.image.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  findById(imageId: number) {
    return this.prisma.image.findUnique({ where: { id: imageId } });
  }
}
