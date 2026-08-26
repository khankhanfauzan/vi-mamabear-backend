export class CursorPaginationMetaDto {
  limit: number
  nextCursor: number | null
  hasNextPage: boolean

  constructor(limit: number, nextCursor: number | null) {
    this.limit = limit
    this.nextCursor = nextCursor
    this.hasNextPage = nextCursor !== null
  }
}

export class CursorPaginationResponseDto<T> {
  success: boolean
  data: T[]
  pagination: CursorPaginationMetaDto

  constructor(data: T[], pagination: CursorPaginationMetaDto) {
    this.success = true
    this.data = data
    this.pagination = pagination
  }
}