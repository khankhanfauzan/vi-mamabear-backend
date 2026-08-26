export class FilterPaginationMetaDto {
  nextCursor: string | null
  hasNextPage: boolean
  limit: number

  constructor(limit: number, nextCursor: string | null) {
    this.limit = limit
    this.nextCursor = nextCursor
    this.hasNextPage = nextCursor !== null
  }
}

export class FilterPaginationResponseDto<T> {
  success: boolean
  data: T[]
  pagination: FilterPaginationMetaDto

  constructor(data: T[], pagination: FilterPaginationMetaDto) {
    this.success = true
    this.data = data
    this.pagination = pagination
  }
}
