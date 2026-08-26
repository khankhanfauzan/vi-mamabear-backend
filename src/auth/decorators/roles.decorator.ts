import { Role } from '@/generated/prisma';
import { Reflector } from '@nestjs/core';

export const Roles = Reflector.createDecorator<Role[] | string[]>();
