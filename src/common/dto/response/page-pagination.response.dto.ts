export class PagePaginationMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;

  constructor(page: number, limit: number, totalItems: number) {
    this.page = page;
    this.limit = limit;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / limit);
    this.hasNextPage = page < this.totalPages;
    this.hasPrevPage = page > 1;
  }
}

export class PagePaginationResponseDto<T> {
  success: boolean;
  data: T[];
  pagination: PagePaginationMetaDto;

  constructor(data: T[], pagination: PagePaginationMetaDto) {
    this.success = true;
    this.data = data;
    this.pagination = pagination;
  }
}
