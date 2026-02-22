import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const session = request.session;

    if (!session || !session.userId || !session.email) {
      return null;
    }

    return {
      id: session.userId,
      email: session.email,
    };
  },
);
