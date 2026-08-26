import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Image } from '@/generated/prisma';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    const { images, ...categoryData } = dto;
    return this.prisma.category.create({
      data: {
        name: categoryData.name,
        slug: categoryData.slug!,
        description: categoryData.description ?? '',
        isActive: categoryData.isActive,
        sortOrder: categoryData.sortOrder,
        metaTitle: categoryData.metaTitle ?? categoryData.name,
        metaDescription:
          categoryData.metaDescription ?? categoryData.description,
        ...(images?.length && {
          images: {
            createMany: {
              data: images.map((img) => ({
                imageUrl: img.imageUrl,
                publicId: img.publicId,
                width: img.width,
                height: img.height,
                fileSize: img.fileSize,
                format: img.format,
                sortOrder: img.sortOrder,
                altText: img.altText,
              })),
            },
          },
        }),
      },
      include: { images: true },
    });
  }

  update(id: number, dto: UpdateCategoryDto) {
    const { images, ...categoryData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: categoryData,
        include: { images: true },
      });
      let imageUpserts: Image[] = [];
      if (images && images.length > 0) {
        imageUpserts = await Promise.all(
          images.map(async (img) => {
            return await tx.image.upsert({
              where: { publicId: img.publicId },
              update: {
                sortOrder: img.sortOrder,
                altText: img.altText,
                categoryId: id,
              },
              create: { ...img, categoryId: id },
            });
          }),
        );
      }
      return {
        ...category,
        images: category.images.concat(imageUpserts ?? []),
      };
    });
  }

  delete(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }

  findAll() {
    return this.prisma.category.findMany({
      include: {
        images: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: { products: true, images: true },
    });
  }

  findById(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        _count: {
          select: { products: true },
        },
      },
    });
  }
}
