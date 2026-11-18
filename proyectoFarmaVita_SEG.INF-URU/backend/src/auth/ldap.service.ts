import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Client, InvalidCredentialsError } from 'ldapts';
import { ROLES_VALIDOS, Rol } from './roles.enum';

/** Escapa un valor para filtros LDAP (RFC 4515). */
export function escaparFiltroLdap(valor: string): string {
  return valor.replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

/** Escapa un valor para un RDN de un DN (RFC 4514). */
export function escaparDnLdap(valor: string): string {
  return valor
    .replace(/[\\,+"<>;=]/g, (c) => '\\' + c)
    .replace(/^[ #]/, (c) => '\\' + c)
    .replace(/ $/, '\\ ');
}

export interface IdentidadLdap {
  dn: string;
  uid: string;
  nombre: string;
  rol: Rol;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger('LDAP');
  private readonly url = process.env.LDAP_URL ?? 'ldap://farma_ldap:389';
  private readonly baseDn = process.env.LDAP_BASE_DN ?? 'dc=farmaceutica,dc=local';
  private readonly adminDn = process.env.LDAP_ADMIN_DN ?? `cn=admin,${this.baseDn}`;
  private readonly adminPassword = process.env.LDAP_ADMIN_PASSWORD ?? '';

  private nuevoCliente(): Client {
    return new Client({ url: this.url, timeout: 5000, connectTimeout: 5000 });
  }

  /**
   * 1) Bind directo con las credenciales del usuario (prueba de identidad).
   * 2) Bind de servicio para leer ou=grupos y resolver el rol (groupOfNames/member).
   */
  async autenticar(usuario: string, password: string): Promise<IdentidadLdap> {
    if (!password) {
      // Un bind con contraseña vacía es un "unauthenticated bind" que algunos
      // servidores aceptan: se rechaza explícitamente.
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const userDn = `uid=${escaparDnLdap(usuario)},ou=usuarios,${this.baseDn}`;

    // --- Paso 1: bind directo del usuario ---
    const clienteUsuario = this.nuevoCliente();
    let nombre = usuario;
    try {
      await clienteUsuario.bind(userDn, password);
      const { searchEntries } = await clienteUsuario.search(userDn, {
        scope: 'base',
        attributes: ['cn'],
      });
      if (searchEntries[0]?.cn) {
        nombre = String(searchEntries[0].cn);
      }
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        this.logger.warn(`Bind fallido para ${usuario}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }
      // Lectura del propio cn no permitida por ACL: no es crítico
      if ((err as Error)?.name === 'InsufficientAccessError' || (err as Error)?.name === 'NoSuchObjectError') {
        this.logger.warn(`Lectura de atributos restringida para ${usuario}`);
      } else {
        this.logger.error(`Error LDAP en bind de usuario: ${(err as Error).message}`);
        throw new ServiceUnavailableException('Servicio de directorio no disponible');
      }
    } finally {
      await clienteUsuario.unbind().catch(() => undefined);
    }

    // --- Paso 2: resolución de grupo/rol ---
    const clienteServicio = this.nuevoCliente();
    try {
      await clienteServicio.bind(this.adminDn, this.adminPassword);
      const { searchEntries } = await clienteServicio.search(`ou=grupos,${this.baseDn}`, {
        scope: 'sub',
        filter: `(&(objectClass=groupOfNames)(member=${escaparFiltroLdap(userDn)}))`,
        attributes: ['cn'],
      });

      const grupos = searchEntries.map((e) => String(e.cn));
      const rol = grupos.find((g) => ROLES_VALIDOS.includes(g)) as Rol | undefined;
      if (!rol) {
        this.logger.warn(`Usuario ${usuario} autenticado pero sin grupo de rol`);
        throw new UnauthorizedException('Usuario sin rol asignado en el directorio');
      }

      this.logger.log(`Autenticación correcta: ${usuario} -> rol ${rol}`);
      return { dn: userDn, uid: usuario, nombre, rol };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Error LDAP en búsqueda de grupos: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Servicio de directorio no disponible');
    } finally {
      await clienteServicio.unbind().catch(() => undefined);
    }
  }
}
