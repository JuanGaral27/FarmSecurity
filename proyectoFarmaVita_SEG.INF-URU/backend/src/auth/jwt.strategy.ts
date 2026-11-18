import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ROLES_VALIDOS, Rol, UsuarioJwt } from './roles.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'cambiar_en_produccion',
      algorithms: ['HS256'],
    });
  }

  validate(payload: { sub?: string; username?: string; role?: string }): UsuarioJwt {
    if (!payload?.sub || !payload.username || !payload.role || !ROLES_VALIDOS.includes(payload.role)) {
      throw new UnauthorizedException('Token con payload inválido');
    }
    return { sub: payload.sub, username: payload.username, role: payload.role as Rol };
  }
}
