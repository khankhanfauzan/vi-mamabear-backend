import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesRepository } from './addresses.repository';

describe('AddressesService', () => {
  let service: AddressesService;

  const mockRepo = {
    createAddress: jest.fn(),
    findAddressesByUserId: jest.fn(),
    findAddressById: jest.fn(),
    updateAddress: jest.fn(),
    deleteAddress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        { provide: AddressesRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isMyAddress', () => {
    it('returns true when the address belongs to the user', () => {
      const result = service.isMyAddress('user-1', {
        userId: 'user-1',
      } as any);
      expect(result).toBe(true);
    });

    it('returns false when the address belongs to a different user', () => {
      const result = service.isMyAddress('user-1', {
        userId: 'user-2',
      } as any);
      expect(result).toBe(false);
    });
  });

  describe('findMyAddress', () => {
    it('throws NotFoundException when the address does not exist', async () => {
      mockRepo.findAddressById.mockResolvedValue(null);

      await expect(service.findMyAddress('user-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException when the address belongs to another user', async () => {
      mockRepo.findAddressById.mockResolvedValue({
        id: 1,
        userId: 'someone-else',
      });

      await expect(service.findMyAddress('user-1', 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the address when it belongs to the requesting user', async () => {
      const address = { id: 1, userId: 'user-1' };
      mockRepo.findAddressById.mockResolvedValue(address);

      const result = await service.findMyAddress('user-1', 1);

      expect(result).toEqual(address);
    });
  });

  describe('findMyAddresses', () => {
    it('throws NotFoundException when the user has no addresses', async () => {
      mockRepo.findAddressesByUserId.mockResolvedValue([]);

      await expect(service.findMyAddresses('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the list of addresses when found', async () => {
      const addresses = [{ id: 1 }, { id: 2 }];
      mockRepo.findAddressesByUserId.mockResolvedValue(addresses);

      const result = await service.findMyAddresses('user-1');

      expect(result).toEqual(addresses);
    });
  });

  describe('deleteMyAddress', () => {
    it('deletes the address and returns a success envelope', async () => {
      const address = { id: 1, userId: 'user-1' };
      mockRepo.findAddressById.mockResolvedValue(address);
      mockRepo.deleteAddress.mockResolvedValue({ id: 1 });

      const result = await service.deleteMyAddress('user-1', 1);

      expect(mockRepo.deleteAddress).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        success: true,
        message: 'Address deleted successfully',
        data: null,
      });
    });
  });
});
