import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { MidtransService } from './midtrans.service';
import { OrderRepository } from '@/order/order.repository';
import { PinoLogger } from 'pino-nestjs';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockSnap = {};
  const mockOrderRepo = {};
  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: MidtransService, useValue: mockSnap },
        { provide: OrderRepository, useValue: mockOrderRepo },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
