import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from './mail.service';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PinoLogger } from 'pino-nestjs';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let repo: AuthRepository;
  let prisma: PrismaService;
  let jwt: JwtService;
  let mail: MailService;
  let logger: PinoLogger;

  const mockRepo = {
    findEmail: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findUserByVerificationToken: jest.fn(),
    findUserById: jest.fn(),
    findUserByResetToken: jest.fn(),
  };
  const mockJwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const mockMail = {
    sendVerificationEmail: jest.fn(),
    sendForgotPasswordMail: jest.fn(),
  };
  const mockLogger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
  const mockRes = {
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockRepo },
        { provide: JwtService, useValue: mockJwt },
        { provide: MailService, useValue: mockMail },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    repo = module.get<AuthRepository>(AuthRepository);
    service = module.get<AuthService>(AuthService);

    jest.resetAllMocks();
  });

  it('should login successfully', async () => {
    const dto = { email: 'test@gmail.com', password: 'test123' };

    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'hashed',
      isVerified: true,
    };

    const result = {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
      },
    };

    mockRepo.findEmail.mockResolvedValue(user);

    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedRefreshToken' as never);

    mockJwt.signAsync
      .mockResolvedValueOnce('accessToken')
      .mockResolvedValueOnce('refreshToken');

    const resultResponse = await service.login(dto, mockRes);
    expect(resultResponse).toEqual(result);
    expect(mockRepo.findEmail).toHaveBeenCalledWith(dto.email);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      dto.password,
      user.hashedPassword,
    );
    expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: user.id },
      expect.objectContaining({
        refreshToken: 'hashedRefreshToken',
        refreshTokenExpiry: expect.any(Date),
      }),
    );
  });
  it('should throw BadRequestException if email is not found for login', async () => {
    const dto = { email: 'wrong@gmail.com', password: 'password' };

    mockRepo.findEmail.mockResolvedValue(null);

    await expect(service.login(dto, mockRes)).rejects.toThrow(
      new BadRequestException('Email not found'),
    );
  });

  it('should throw BadRequestException if password is invalid for login', async () => {
    const dto = { email: 'test@gmail.com', password: 'wrongPassword' };

    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'hashed',
      isVerified: true,
    };

    mockRepo.findEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(dto, mockRes)).rejects.toThrow(
      new BadRequestException('Invalid password'),
    );
  });

  it('should throw BadRequestException if user is not verified for login', async () => {
    const dto = { email: 'test@gmail.com', password: 'test123' };
    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'hashed',
      isVerified: false,
    };
    mockRepo.findEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(dto, mockRes)).rejects.toThrow(
      new BadRequestException('Invalid password'),
    );
  });

  it('should register successfully', async () => {
    const dto = {
      email: 'test@gmail.com',
      password: 'test123',
      name: 'test',
      phone: '0822',
    };

    mockRepo.findEmail.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: () => 'verificationToken',
    });

    mockRepo.create.mockResolvedValue({
      id: 'userId-1',
      ...dto,
    });

    const sendEmailSpy = jest
      .spyOn(mockMail, 'sendVerificationEmail')
      .mockResolvedValue(undefined);

    const resultResponse = await service.register(dto);
    expect(resultResponse).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(mockRepo.findEmail).toHaveBeenCalledWith(dto.email);
    expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: dto.name,
      email: dto.email,
      hashedPassword: 'hashedPassword',
      phone: dto.phone,
      verificationToken: 'verificationToken',
      verificationTokenExpiry: expect.any(Date),
    });
    expect(sendEmailSpy).toHaveBeenCalledWith(dto.email, 'verificationToken');
  });

  it('should throw BadRequestException if email already exist for register', async () => {
    const dto = {
      email: 'test@gmail.com',
      password: 'test123',
      name: 'test',
      phone: '0822',
    };

    mockRepo.findEmail.mockResolvedValue(dto);

    await expect(service.register(dto)).rejects.toThrow(
      new BadRequestException('Email already exist'),
    );
    expect(mockRepo.findEmail).toHaveBeenCalledWith(dto.email);

    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should verify email successfully for register', async () => {
    const user = {
      id: 'userId-1',
      verificationToken: 'valid-token',
      verificationTokenExpiry: new Date('2099-01-01'),
    };

    const result = {
      success: true,
      message: 'Email verified successfully',
      data: null,
    };

    mockRepo.findUserByVerificationToken.mockResolvedValue(user);
    const resultResPonse = await service.verifyEmail(user.verificationToken);
    expect(resultResPonse).toEqual(result);
    expect(mockRepo.findUserByVerificationToken).toHaveBeenCalledWith(
      user.verificationToken,
    );

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: user.id },
      expect.objectContaining({
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      }),
    );
  });

  it('should throw BadRequestException for invalid token for register', async () => {
    const user = {
      id: 'userId-1',
      verificationToken: 'valid-token',
      verificationTokenExpiry: new Date('2099-01-01'),
    };

    mockRepo.findUserByVerificationToken.mockResolvedValue(null);

    await expect(service.verifyEmail(user.verificationToken)).rejects.toThrow(
      new BadRequestException('Invalid token'),
    );
    expect(mockRepo.findUserByVerificationToken).toHaveBeenCalledWith(
      user.verificationToken,
    );
  });

  it('should throw BadRequestException for token expired for register', async () => {
    const user = {
      id: 'userId-1',
      verificationToken: 'valid-token',
      verificationTokenExpiry: new Date('1999-01-01'),
    };

    mockRepo.findUserByVerificationToken.mockResolvedValue(user);

    await expect(service.verifyEmail(user.verificationToken)).rejects.toThrow(
      new BadRequestException('Token expired'),
    );
    expect(mockRepo.findUserByVerificationToken).toHaveBeenCalledWith(
      user.verificationToken,
    );
  });

  it('should refresh token successfully for refreshToken', async () => {
    const payload = {
      sub: 'userId-1',
    };
    const refreshToken = 'valid-refresh-token';

    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      role: 'user',
      refreshToken: 'hashedRefreshToken',
      refreshTokenExpiry: new Date('2099-01-01'),
    };
    const result = {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
      },
    };

    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockRepo.findUserById.mockResolvedValue(user);

    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewRefreshToken' as never);
    mockJwt.signAsync
      .mockResolvedValueOnce('newRefreshToken')
      .mockResolvedValueOnce('newAccessToken');

    const response = await service.refreshToken(refreshToken);

    expect(mockJwt.verifyAsync).toHaveBeenCalledWith(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
    expect(mockRepo.findUserById).toHaveBeenCalledWith(payload.sub);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      refreshToken,
      user.refreshToken,
    );
    expect(mockJwt.signAsync).toHaveBeenCalledWith(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: undefined,
        phone: undefined,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );
    expect(response).toEqual(result);
  });

  it('should throw new UnauthorizedException for refresh token not found for refreshToken', async () => {
    const user = {
      id: 'userId-1',
      refreshToken: null,
    };
    const payload = {
      sub: 'userId-1',
    };
    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockRepo.findUserById.mockResolvedValue(user);

    await expect(service.refreshToken('token')).rejects.toThrow(
      new UnauthorizedException('Refresh token not found'),
    );
    expect(mockJwt.verifyAsync).toHaveBeenCalledWith('token', {
      secret: process.env.JWT_REFRESH_SECRET,
    });
    expect(mockRepo.findUserById).toHaveBeenCalledWith(payload.sub);
  });

  it('should throw new UnauthorizedException for invalid userId forRefreshToken', async () => {
    const refreshToken = 'valid-refresh-token';
    const payload = {
      sub: 'userId-1',
    };

    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockRepo.findUserById.mockResolvedValue(null);

    await expect(service.refreshToken(refreshToken)).rejects.toThrow(
      new UnauthorizedException('User not found'),
    );
    expect(mockJwt.verifyAsync).toHaveBeenCalledWith(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
    expect(mockRepo.findUserById).toHaveBeenCalledWith(payload.sub);
  });

  it('should throw new UnauthorizedException for invalid refresh token for refresToken', async () => {
    const refreshToken = 'valid-refresh-token';
    const payload = {
      sub: 'userId-1',
    };
    const user = {
      id: 'userId-1',
      refreshToken: 'invalid-token',
    };
    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockRepo.findUserById.mockResolvedValue(user);

    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(service.refreshToken(refreshToken)).rejects.toThrow(
      new UnauthorizedException('Invalid refresh token'),
    );
    expect(bcrypt.compare).toHaveBeenCalledWith(
      refreshToken,
      user.refreshToken,
    );
    expect(mockRepo.findUserById).toHaveBeenCalledWith(user.id);
    expect(mockJwt.verifyAsync).toHaveBeenCalledWith(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
  });

  it('should throw new BadRequestException for refresh token expired for refresToken', async () => {
    const payload = {
      sub: 'userId-1',
    };
    const user = {
      id: 'userId-1',
      refreshToken: 'valid-token',
      refreshTokenExpiry: new Date('1999-01-01'),
    };
    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockRepo.findUserById.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await expect(service.refreshToken('token')).rejects.toThrow(
      'Refresh token expired',
    );
    expect(mockJwt.verifyAsync).toHaveBeenCalledWith('token', {
      secret: process.env.JWT_REFRESH_SECRET,
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('token', user.refreshToken);
    expect(mockRepo.findUserById).toHaveBeenCalledWith(user.id);

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: user.id },
      { refreshToken: null, refreshTokenExpiry: null },
    );
  });

  it('should logout successfully', async () => {
    const user = {
      id: 'userId-1',
    };

    const result = {
      success: true,
      message: 'Logout success',
      data: null,
    };

    mockRepo.findUserById.mockResolvedValue(user);
    const resultResponse = await service.logout(user.id, mockRes);
    expect(mockRepo.findUserById).toHaveBeenCalledWith(user.id);
    expect(mockRepo.update).toHaveBeenCalledWith(
      {
        id: user.id,
      },
      {
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    );
    expect(resultResponse).toEqual(result);
  });

  it('should throw new BadRequestException for user user not found for logout', async () => {
    const user = {
      id: 'userId-1',
    };

    mockRepo.findUserById.mockResolvedValue(null);

    await expect(service.logout(user.id, mockRes)).rejects.toThrow('User not found');
  });

  it('should forgot password successfully for logout', async () => {
    const dto = {
      email: 'test@gmail.com',
    };

    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
    };

    const result = {
      message: 'Check your email to reset password',
    };

    mockRepo.findEmail.mockResolvedValue(user);

    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: () => 'resetToken',
    });

    const resultResponse = await service.forgotPassword(dto);
    expect(resultResponse).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(mockRepo.findEmail).toHaveBeenCalledWith(dto.email);
    expect(crypto.randomBytes).toHaveBeenCalledWith(32);

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: user.id },
      {
        resetToken: 'resetToken',
        resetTokenExpiry: expect.any(Date),
      },
    );

    expect(mockMail.sendForgotPasswordMail).toHaveBeenCalledWith(
      dto.email,
      'resetToken',
    );
  });

  it('should throw new BadRequestException for user not found for logout', async () => {
    const dto = {
      email: 'test@gmail.com',
    };

    mockRepo.findEmail.mockResolvedValue(null);

    await expect(service.forgotPassword(dto)).rejects.toThrow('User not found');
    expect(mockRepo.findEmail).toHaveBeenCalledWith(dto.email);
  });

  it('should reset password successfully', async () => {
    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'test123',
      resetToken: 'validResetToken',
      resetTokenExpiry: new Date('2199-01-01'),
    };
    const token = 'validResetToken';

    const dto = {
      password: 'test123',
    };
    const result = {
      success: true,
      message: 'Password reset success',
      data: null,
    };

    mockRepo.findUserByResetToken.mockResolvedValue(user);

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);

    const resultResponse = await service.resetPassword(token, dto);
    expect(mockRepo.findUserByResetToken).toHaveBeenCalledWith(user.resetToken);
    expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: user.id },
      {
        hashedPassword: 'hashedPassword',
        refreshToken: null,
        refreshTokenExpiry: null,
        resetToken: null,
        resetTokenExpiry: null,
      },
    );

    expect(resultResponse).toEqual(result);
  });

  it('should throw new BadRequestException invalid token for reset password', async () => {
    const dto = {
      password: 'test123',
    };

    const token = 'invalidTokenResetToken';
    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'test123',
      resetToken: 'resetToken',
      resetTokenExpiry: new Date('2999-01-01'),
    };

    mockRepo.findUserByResetToken.mockResolvedValue(null);

    await expect(service.resetPassword(token, dto)).rejects.toThrow('Invalid token');
    expect(mockRepo.findUserByResetToken).toHaveBeenCalledWith(token);
  });

  it('should throw new BadRequestException reset token expired for reset password ', async () => {
    const user = {
      id: 'userId-1',
      email: 'test@gmail.com',
      hashedPassword: 'hashed',
      resetToken: 'validResetToken',
      resetTokenExpiry: new Date('1999-01-01'),
    };
    const token = 'validResetToken';

    const dto = {
      password: 'test123',
    };

    mockRepo.findUserByResetToken.mockResolvedValue(user);

    await expect(service.resetPassword(token, dto)).rejects.toThrow(
      'Reset token expired',
    );
    expect(mockRepo.findUserByResetToken).toHaveBeenCalledWith(token);
  });
});
