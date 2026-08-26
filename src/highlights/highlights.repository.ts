import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const HIGHLIGHT_INCLUDE = { products: true };

@Injectable()
export class HighlightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.HighlightCreateInput) {
    return this.prisma.highlight.create({ data, include: HIGHLIGHT_INCLUDE });
  }

  findAll() {
    return this.prisma.highlight.findMany({ include: HIGHLIGHT_INCLUDE });
  }

  findById(id: number) {
    return this.prisma.highlight.findUnique({
      where: { id },
      include: HIGHLIGHT_INCLUDE,
    });
  }

  findBySlug(slug: string) {
    return this.prisma.highlight.findUnique({ where: { slug } });
  }

  update(
    where: Prisma.HighlightWhereUniqueInput,
    data: Prisma.HighlightUpdateInput,
  ) {
    return this.prisma.highlight.update({ where, data, include: HIGHLIGHT_INCLUDE });
  }

  delete(where: Prisma.HighlightWhereUniqueInput) {
    return this.prisma.highlight.delete({ where });
  }
}
