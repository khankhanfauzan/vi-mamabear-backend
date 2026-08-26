import { CursorPaginationService } from './pagination.service'
import { CursorPaginationRequestDto } from '../dto/request/pagination.request.dto'

describe('CursorPaginationService', () => {
  let service: CursorPaginationService

  const mockModel = {
    findMany: jest.fn(),
  }

  beforeEach(() => {
    service = new CursorPaginationService()
    jest.clearAllMocks()
  })

  it('should return paginated data without cursor', async () => {
    const dto = { limit: 2 } as CursorPaginationRequestDto

    mockModel.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    const result = await service.paginate(mockModel, dto)

    expect(mockModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        cursor: undefined,
        skip: 0,
        orderBy: { id: 'asc' },
      }),
    )

    expect(result.data).toHaveLength(2)
    expect(result.pagination.nextCursor).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
  })

  it('should use cursor correctly', async () => {
    const dto = {
      cursor: 2,
      limit: 2,
    } as CursorPaginationRequestDto

    mockModel.findMany.mockResolvedValue([
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ])

    const result = await service.paginate(mockModel, dto)

    expect(mockModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        cursor: { id: 2 },
        skip: 1,
        orderBy: { id: 'asc' },
      }),
    )

    expect(result.pagination.nextCursor).toBe(5)
  })

  it('should fallback to default sort', async () => {
    const dto = { limit: 2 } as CursorPaginationRequestDto

    mockModel.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    await service.paginate(mockModel, dto, {}, {
      orderDirection: 'desc',
    })

    expect(mockModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'desc' },
      }),
    )
  })

  it('should return null nextCursor if no more data', async () => {
    const dto = { limit: 3 } as CursorPaginationRequestDto

    mockModel.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ])

    const result = await service.paginate(mockModel, dto)

    expect(result.pagination.nextCursor).toBeNull()
    expect(result.pagination.hasNextPage).toBe(false)
    expect(result.data).toHaveLength(2)
  })

  it('should support custom cursor field', async () => {
    const dto = { limit: 2 } as CursorPaginationRequestDto

    mockModel.findMany.mockResolvedValue([
      { uuid: 'a' },
      { uuid: 'b' },
      { uuid: 'c' },
    ])

    const result = await service.paginate(
      mockModel,
      dto,
      {},
      { cursorField: 'uuid' },
    )

    expect(mockModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { uuid: 'asc' },
      }),
    )

    expect(result.pagination.nextCursor).toBe('c')
  })
})