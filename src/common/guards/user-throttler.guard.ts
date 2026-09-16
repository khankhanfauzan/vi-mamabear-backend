import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const authReq = req as unknown as AuthenticatedRequest;
    const tracker = authReq.user?.userId ?? authReq.ip ?? 'anonymous';
    return Promise.resolve(tracker);
  }
}
