import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class WorkerAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('WORKER_ADMIN_TOKEN');
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];

    if (token && expected) {
      const received = Buffer.from(token);
      const secret = Buffer.from(expected);
      if (
        received.length === secret.length &&
        timingSafeEqual(received, secret)
      ) {
        return true;
      }
    }

    throw new UnauthorizedException('Site Admin authorization required');
  }
}
