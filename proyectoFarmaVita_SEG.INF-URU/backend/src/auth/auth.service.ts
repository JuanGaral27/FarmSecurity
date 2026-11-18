import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LdapService } from './ldap.service';
import { Rol, UsuarioJwt } from './roles.enum';

export interface RespuestaLogin {
  access_token: string;
  token_type: 'Bearer';
  expires_in: string;
  username: string;
  nombre: string;
  role: Rol;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly ldap: LdapService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<RespuestaLogin> {
    const identidad = await this.ldap.autenticar(username, password);
    const payload: UsuarioJwt = { sub: identidad.dn, username: identidad.uid, role: identidad.rol };
    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: process.env.JWT_EXPIRES_IN ?? '8h',
      username: identidad.uid,
      nombre: identidad.nombre,
      role: identidad.rol,
    };
  }
}
