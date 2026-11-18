import { SetMetadata } from '@nestjs/common';
import { Rol } from './roles.enum';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a uno o varios roles LDAP. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
