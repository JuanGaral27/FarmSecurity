import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioJwt } from './roles.enum';

/** Inyecta el usuario autenticado (payload JWT validado). */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioJwt =>
    ctx.switchToHttp().getRequest<{ user: UsuarioJwt }>().user,
);
