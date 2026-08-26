import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@/generated/prisma';
import { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const mockRes = {
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should call authService.login', async () => {
    const dto = { email: 'test@gmail.com', password: 'test123' };
    const result = {
      accessToken: 'asdfasd',
      refreshToken: 'asdfasd',
    };
    mockAuthService.login.mockResolvedValue(result);

    const resultResponse = await controller.login(dto, mockRes);
    expect(service.login).toHaveBeenCalledWith(dto, mockRes);
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.register', async () => {
    const dto = {
      email: 'test@gmail.com',
      password: 'test123',
      name: 'test',
      phone: 'test',
    };

    const result = {
      message: 'Register success, check your email to verify',
    };

    mockAuthService.register.mockResolvedValue(result);

    const resultResponse = await controller.register(dto);
    expect(service.register).toHaveBeenCalledWith(dto);
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.logout', async () => {
    const req = {
      sub: 'idUser1',
      email: 'a@em.com',
      role: Role.USER,
    };

    const result = {
      message: 'Logout success',
    };

    mockAuthService.logout.mockResolvedValue(result);

    const resultResponse = await controller.logout(req as any, mockRes);
    expect(service.logout).toHaveBeenCalledWith(req.sub, mockRes);
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.refreshToken', async () => {
    const req = {
      headers: { authorization: 'Bearer RefreshToken' },
    };

    const result = {
      accessToken: 'NewAccessToken',
    };

    mockAuthService.refreshToken.mockResolvedValue(result);

    const resultResponse = await controller.refresh(req as unknown as Request);
    expect(service.refreshToken).toHaveBeenCalledWith('RefreshToken');
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.forgotPassword', async () => {
    const dto = { email: 'test@gmail.com' };

    const result = {
      message: 'Check your email to reset password',
    };

    mockAuthService.forgotPassword.mockResolvedValue(result);

    const resultResponse = await controller.forgotPassword(dto);
    expect(service.forgotPassword).toHaveBeenCalledWith(dto);
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.resetPassword', async () => {
    const token = 'token';
    const dto = { password: 'testtest' };

    const result = {
      message: 'Password reset success',
    };

    mockAuthService.resetPassword.mockResolvedValue(result);
    const resultResponse = await controller.resetPassword(token, dto);
    expect(service.resetPassword).toHaveBeenCalledWith(token, dto);
    expect(resultResponse).toEqual(result);
  });

  it('should call authService.verifyEmail', async () => {
    const token = 'token';

    const result = {
      message: 'Email verified successfully',
    };

    mockAuthService.verifyEmail.mockResolvedValue(result);
    const resultResponse = await controller.verifyEmail(token);
    expect(service.verifyEmail).toHaveBeenCalledWith(token);
    expect(resultResponse).toEqual(result);
  });
});
