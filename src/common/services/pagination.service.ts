import { Injectable } from '@nestjs/common';
import { CursorPaginationRequestDto } from '../dto/request/pagination.request.dto';
import {
  CursorPaginationResponseDto,
  CursorPaginationMetaDto,
} from '../dto/response/pagination.response.dto';

interface ICursorPaginationOptions {
  cursorField?: string;
  orderDirection?: 'asc' | 'desc';
}

@Injectable()
export class CursorPaginationService {
  async paginate<T extends Record<string, any>>(
    model: { findMany: Function },
    paginationDto?: CursorPaginationRequestDto,
    args: any = {},
    options?: ICursorPaginationOptions,
  ): Promise<CursorPaginationResponseDto<T>> {
    let cursor: number | undefined = 0;
    let limit: number | undefined = 10;
    if (paginationDto) {
      cursor = paginationDto.cursor;
      limit = paginationDto.limit;
    }
    const safeCursor = cursor ?? 0;
    const safeLimit = limit ?? 10;
    const cursorField = options?.cursorField ?? 'id';
    const orderDirection = options?.orderDirection ?? 'asc';

    const orderBy = {
      [cursorField]: orderDirection,
    };

    const prismaCursor =
      cursor !== undefined ? { [cursorField]: safeCursor } : undefined;

    const items: T[] = await model.findMany({
      ...args,
      take: safeLimit + 1,
      cursor: prismaCursor,
      skip: cursor !== undefined ? 1 : 0,
      orderBy,
    });

    let nextCursor: number | null = null;
    if (items.length > safeLimit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.[cursorField] ?? null;
    }

    return new CursorPaginationResponseDto(
      items,
      new CursorPaginationMetaDto(safeLimit, nextCursor),
    );
  }
}
