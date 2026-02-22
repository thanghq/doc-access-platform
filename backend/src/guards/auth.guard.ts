import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = (request as any).session;

    if (!session || !session.isAuthenticated || !session.userId) {
      throw new UnauthorizedException('Please log in to access this feature');
    }

    return true;
  }
}
