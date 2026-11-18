import type { LoteCalidad, Medicamento, Sesion, Venta } from '../types';

const BASE = '/api';
const CLAVE_SESION = 'farmavita.sesion';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo?: string,
  ) {
    super(message);
  }
}

// --- Sesión (sessionStorage: se borra al cerrar la pestaña) ---------------
export function cargarSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion): void {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function borrarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* almacenamiento no disponible */
  }
}

let alExpirar: () => void = () => undefined;
export function onSesionExpirada(cb: () => void): void {
  alExpirar = cb;
}

// --- Petición genérica ------------------------------------------------------
async function peticion<T>(ruta: string, opciones: RequestInit = {}, conToken = true): Promise<T> {
  const headers = new Headers(opciones.headers);
  headers.set('Accept', 'application/json');
  if (opciones.body) headers.set('Content-Type', 'application/json');
  if (conToken) {
    const s = cargarSesion();
    if (s) headers.set('Authorization', `Bearer ${s.token}`);
  }

  let resp: Response;
  try {
    resp = await fetch(BASE + ruta, { ...opciones, headers });
  } catch {
    throw new ApiError('No se pudo contactar con la intranet (proxy DMZ).', 0);
  }

  const texto = await resp.text();
  let cuerpo: unknown = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }

  if (!resp.ok) {
    const c = (cuerpo ?? {}) as { message?: string | string[]; codigo?: string };
    let msg = Array.isArray(c.message) ? c.message.join(' · ') : c.message;
    if (!msg) msg = resp.status === 429 ? 'Demasiados intentos. Espere un minuto.' : `Error HTTP ${resp.status}`;
    if (resp.status === 401 && conToken) {
      borrarSesion();
      alExpirar();
    }
    throw new ApiError(msg, resp.status, c.codigo);
  }
  return cuerpo as T;
}

// --- Endpoints --------------------------------------------------------------
export const api = {
  login: (username: string, password: string) =>
    peticion<{ access_token: string; username: string; nombre: string; role: Sesion['role'] }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      false,
    ),

  medicamentos: () => peticion<Medicamento[]>('/inventario/medicamentos'),

  crearMedicamento: (m: Omit<Medicamento, 'id'>) =>
    peticion<Medicamento>('/inventario/medicamentos', { method: 'POST', body: JSON.stringify(m) }),

  ingresarStock: (id: number, cantidad: number, lote?: string) =>
    peticion<Medicamento>(`/inventario/medicamentos/${id}/ingreso`, {
      method: 'POST',
      body: JSON.stringify(lote ? { cantidad, lote } : { cantidad }),
    }),

  lotes: () => peticion<LoteCalidad[]>('/laboratorio/lotes'),

  evaluarLote: (
    codigoLote: string,
    datos: { estado: 'APROBADO' | 'RECHAZADO'; temperaturaRegistro: number; observaciones?: string },
  ) =>
    peticion<LoteCalidad>(`/laboratorio/lotes/${encodeURIComponent(codigoLote)}/evaluar`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  ventas: () => peticion<Venta[]>('/ventas'),

  vender: (medicamentoId: number, cantidad: number) =>
    peticion<Venta>('/ventas', { method: 'POST', body: JSON.stringify({ medicamentoId, cantidad }) }),
};

export const moneda = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(n);

export const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
