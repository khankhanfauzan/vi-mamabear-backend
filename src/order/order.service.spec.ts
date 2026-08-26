import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from './order.repository';
import { MailService } from '@/auth/mail.service';

describe('OrderService', () => {
  let service: OrderService;

  const mockRepo = {};
  const mockMail = {
    sendVerificationEmail: jest.fn(),
    sendForgotPasswordMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: mockRepo },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
