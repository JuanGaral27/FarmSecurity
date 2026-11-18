export enum Rol {
  ALMACEN = 'almacen',
  VENTAS = 'ventas',
  LABORATORIO = 'laboratorio',
  ADMIN = 'admin',
}

export const ROLES_VALIDOS: string[] = Object.values(Rol);

export interface UsuarioJwt {
  sub: string;
  username: string;
  role: Rol;
}
