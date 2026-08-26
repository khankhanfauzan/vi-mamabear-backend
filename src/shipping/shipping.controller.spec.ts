import { Test, TestingModule } from '@nestjs/testing';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

describe('ShippingController', () => {
  let controller: ShippingController;

  const mockService = {
    findAllProvince: jest.fn(),
    findCitiesByProvinceId: jest.fn(),
    findDistrictsByCityId: jest.fn(),
    findSubdistrictsByDistrictId: jest.fn(),
    calculateShippingCost: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingController],
      providers: [{ provide: ShippingService, useValue: mockService }],
    }).compile();

    controller = module.get<ShippingController>(ShippingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
