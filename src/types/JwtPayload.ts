import { Role } from '@/generated/prisma';

// Payload obtained by decoding JWT
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
