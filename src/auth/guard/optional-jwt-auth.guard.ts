import { AuthGuard } from '@nestjs/passport';
import { Injectable, ExecutionContext } from '@nestjs/common';

interface JwtUserPayload {
  sub: string;
  name: string;
  email: string;
  role: string;
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtUserPayload>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
