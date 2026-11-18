import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, moneda } from '../api/client';
import type { Medicamento, Rol } from '../types';
import Alerta from './Alerta';

interface Props {
  rol: Rol;
}

const ALTA_VACIA = {
  nombre: '',
  principioActivo: '',
  loteActual: '',
  stock: 0,
  precio: 1,
  temperaturaRequerida: 25,
  requiereCadenaFrio: false,
};

export default function Inventario({ rol }: Props) {
  const puedeEditar = rol === 'almacen';
  const [meds, setMeds] = useState<Medicamento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Ingreso de mercancía
  const [ingresoId, setIngresoId] = useState<number | ''>('');
  const [ingresoCant, setIngresoCant] = useState(1);
  const [ingresoLote, setIngresoLote] = useState('');

  // Alta
  const [alta, setAlta] = useState(ALTA_VACIA);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setMeds(await api.medicamentos());
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    if (ingresoId === '') return;
    setError(null);
    setExito(null);
    try {
      const m = await api.ingresarStock(ingresoId, ingresoCant, ingresoLote.trim().toUpperCase() || undefined);
      setExito(
        `Ingreso registrado: +${ingresoCant} de "${m.nombre}". Stock actual: ${m.stock}.` +
          (ingresoLote ? ` El lote ${m.loteActual} queda en cuarentena hasta su evaluación por Laboratorio.` : ''),
      );
      setIngresoCant(1);
      setIngresoLote('');
      await cargar();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);
    try {
      const m = await api.crearMedicamento({ ...alta, loteActual: alta.loteActual.trim().toUpperCase() });
      setExito(`Medicamento "${m.nombre}" dado de alta. Lote ${m.loteActual} enviado a Laboratorio (PENDIENTE).`);
      setAlta(ALTA_VACIA);
      await cargar();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <section>
      <div className="encabezado">
        <h2>Inventario de medicamentos</h2>
        <button className="secundario" onClick={() => void cargar()} disabled={cargando}>
          ↻ Actualizar
        </button>
      </div>

      {error && <Alerta tipo="error" onCerrar={() => setError(null)}>{error}</Alerta>}
      {exito && <Alerta tipo="exito" onCerrar={() => setExito(null)}>{exito}</Alerta>}

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Medicamento</th>
              <th>Principio activo</th>
              <th>Lote actual</th>
              <th className="num">Stock</th>
              <th className="num">Precio</th>
              <th>Conservación</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>
                  <strong>{m.nombre}</strong>
                </td>
                <td>{m.principioActivo}</td>
                <td>
                  <code>{m.loteActual}</code>
                </td>
                <td className={`num ${m.stock < 50 ? 'bajo' : ''}`}>{m.stock}</td>
                <td className="num">{moneda(m.precio)}</td>
                <td>
                  {m.requiereCadenaFrio ? (
                    <span className="chip frio">❄ Cadena de frío 2–{m.temperaturaRequerida} °C</span>
                  ) : (
                    <span className="chip">≤ {m.temperaturaRequerida} °C</span>
                  )}
                </td>
              </tr>
            ))}
            {!cargando && meds.length === 0 && (
              <tr>
                <td colSpan={7} className="vacio">
                  Sin medicamentos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {puedeEditar ? (
        <div className="rejilla-2">
          <form className="tarjeta" onSubmit={ingresar}>
            <h3>Ingreso de mercancía</h3>
            <label>
              Medicamento
              <select value={ingresoId} onChange={(e) => setIngresoId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">— Seleccione —</option>
                {meds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} (stock {m.stock})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad recibida
              <input type="number" min={1} value={ingresoCant} onChange={(e) => setIngresoCant(Number(e.target.value))} required />
            </label>
            <label>
              Nuevo código de lote (opcional)
              <input
                value={ingresoLote}
                onChange={(e) => setIngresoLote(e.target.value.toUpperCase())}
                placeholder="LT-XXX-2026-000"
                pattern="[A-Z0-9-]{3,60}"
              />
            </label>
            <button type="submit">Registrar ingreso</button>
          </form>

          <form className="tarjeta" onSubmit={crear}>
            <h3>Alta de medicamento</h3>
            <label>
              Nombre comercial
              <input value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} required />
            </label>
            <label>
              Principio activo
              <input
                value={alta.principioActivo}
                onChange={(e) => setAlta({ ...alta, principioActivo: e.target.value })}
                required
              />
            </label>
            <div className="fila">
              <label>
                Lote inicial
                <input
                  value={alta.loteActual}
                  onChange={(e) => setAlta({ ...alta, loteActual: e.target.value.toUpperCase() })}
                  pattern="[A-Z0-9-]{3,60}"
                  required
                />
              </label>
              <label>
                Stock inicial
                <input
                  type="number"
                  min={0}
                  value={alta.stock}
                  onChange={(e) => setAlta({ ...alta, stock: Number(e.target.value) })}
                  required
                />
              </label>
            </div>
            <div className="fila">
              <label>
                Precio (USD)
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={alta.precio}
                  onChange={(e) => setAlta({ ...alta, precio: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                Temp. máx. (°C)
                <input
                  type="number"
                  step={0.1}
                  value={alta.temperaturaRequerida}
                  onChange={(e) => setAlta({ ...alta, temperaturaRequerida: Number(e.target.value) })}
                  required
                />
              </label>
            </div>
            <label className="casilla">
              <input
                type="checkbox"
                checked={alta.requiereCadenaFrio}
                onChange={(e) =>
                  setAlta({
                    ...alta,
                    requiereCadenaFrio: e.target.checked,
                    temperaturaRequerida: e.target.checked ? 8 : 25,
                  })
                }
              />
              Requiere cadena de frío (2–8 °C)
            </label>
            <button type="submit">Dar de alta</button>
          </form>
        </div>
      ) : (
        <Alerta tipo="info">Vista de solo lectura. El ingreso y alta de mercancía es exclusivo del rol Almacén.</Alerta>
      )}
    </section>
  );
}
