import { JwtAuthGuard } from './guard/jwt-auth.guard';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtPayload } from '@/types/JwtPayload';
import { RefreshGuard } from './guard/refresh.guard';
import { Request, Response } from 'express';

@UseGuards(ThrottlerGuard)
@ApiTags('auth')
@ApiBearerAuth('JwtAuthGuard')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  me(@Req() req: any) {
      return req.user;
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Post('/login')
  login(@Body() dto: LoginUserDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Post('/register')
  register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  @ApiBearerAuth('JwtAuthGuard')
  logout(@Req() req: JwtPayload, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req.sub, res);
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Post('/refresh')
  @UseGuards(RefreshGuard)
  async refresh(@Req() req: Request) {
    const refreshToken =
      req.headers.authorization?.replace('Bearer ', '') ?? '';
    return this.authService.refreshToken(refreshToken);
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Post('/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Post('/reset-password/:token')
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(token, dto);
  }

  @Throttle({
    default: {
      limit: 50,
      ttl: 300_000,
    },
  })
  @Get('/verify-email/:token')
  verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
