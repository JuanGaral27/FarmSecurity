export type Rol = 'almacen' | 'ventas' | 'laboratorio' | 'admin';

export interface Sesion {
  token: string;
  username: string;
  nombre: string;
  role: Rol;
}

export interface Medicamento {
  id: number;
  nombre: string;
  principioActivo: string;
  loteActual: string;
  stock: number;
  precio: number;
  temperaturaRequerida: number;
  requiereCadenaFrio: boolean;
}

export type EstadoLote = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface LoteCalidad {
  id: number;
  codigoLote: string;
  medicamentoId: number;
  medicamentoNombre: string | null;
  requiereCadenaFrio: boolean | null;
  temperaturaRequerida: number | null;
  temperaturaRegistro: number | null;
  estado: EstadoLote;
  observaciones: string | null;
  analistaLdap: string | null;
  fechaEvaluacion: string | null;
  fechaRegistro: string;
}

export interface Venta {
  id: number;
  medicamentoId: number;
  medicamentoNombre: string | null;
  cantidad: number;
  total: number;
  vendedorLdap: string;
  fechaVenta: string;
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  almacen: 'Almacén · VLAN 210',
  ventas: 'Ventas · VLAN 220',
  admin: 'Administración · VLAN 230',
  laboratorio: 'Laboratorio · VLAN 240',
};
