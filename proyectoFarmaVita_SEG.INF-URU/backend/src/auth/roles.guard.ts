import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Rol, UsuarioJwt } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('RBAC');

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: UsuarioJwt; method: string; url: string }>();
    const usuario = req.user;
    if (usuario && requeridos.includes(usuario.role)) {
      return true;
    }

    this.logger.warn(
      `Acceso denegado: ${usuario?.username ?? 'anónimo'} (${usuario?.role ?? '-'}) -> ${req.method} ${req.url}`,
    );
    throw new ForbiddenException(
      `Su rol (${usuario?.role ?? 'ninguno'}) no tiene permiso para esta operación. Requerido: ${requeridos.join(', ')}`,
    );
  }
}
