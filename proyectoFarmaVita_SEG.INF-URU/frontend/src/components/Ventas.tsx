import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, api, fecha, moneda } from '../api/client';
import type { Medicamento, Rol, Venta } from '../types';
import Alerta from './Alerta';

interface Props {
  rol: Rol;
}

interface Problema {
  tipo: 'error' | 'aviso';
  titulo: string;
  detalle: string;
}

export default function Ventas({ rol }: Props) {
  const puedeVender = rol === 'ventas';
  const [meds, setMeds] = useState<Medicamento[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [medId, setMedId] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState(1);
  const [problema, setProblema] = useState<Problema | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [m, v] = await Promise.all([api.medicamentos(), api.ventas()]);
      setMeds(m);
      setVentas(v);
    } catch (e) {
      setProblema({ tipo: 'error', titulo: 'Error al cargar datos', detalle: (e as ApiError).message });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const med = useMemo(() => meds.find((m) => m.id === medId) ?? null, [meds, medId]);
  const total = med ? Math.round(med.precio * cantidad * 100) / 100 : 0;
  const stockInsuficiente = !!med && cantidad > med.stock;
  const totalDia = useMemo(() => {
    const hoy = new Date().toDateString();
    return ventas.filter((v) => new Date(v.fechaVenta).toDateString() === hoy).reduce((s, v) => s + v.total, 0);
  }, [ventas]);

  const vender = async (e: FormEvent) => {
    e.preventDefault();
    if (medId === '') return;
    setProblema(null);
    setExito(null);
    setEnviando(true);
    try {
      const v = await api.vender(medId, cantidad);
      setExito(`Venta #${v.id} registrada: ${v.cantidad} × ${v.medicamentoNombre} = ${moneda(v.total)}`);
      setCantidad(1);
      await cargar();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.codigo === 'LOTE_NO_APROBADO') {
        setProblema({
          tipo: 'error',
          titulo: 'Dispensación bloqueada por trazabilidad',
          detalle: `${e2.message} Contacte a Laboratorio (VLAN 240) para la liberación del lote.`,
        });
      } else if (e2.codigo === 'STOCK_INSUFICIENTE') {
        setProblema({ tipo: 'aviso', titulo: 'Stock insuficiente', detalle: e2.message });
      } else {
        setProblema({ tipo: 'error', titulo: 'No se pudo registrar la venta', detalle: e2.message });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section>
      <div className="encabezado">
        <h2>Ventas y dispensación</h2>
        <button className="secundario" onClick={() => void cargar()}>
          ↻ Actualizar
        </button>
      </div>

      {problema && (
        <Alerta tipo={problema.tipo} onCerrar={() => setProblema(null)}>
          <strong>{problema.titulo}.</strong> {problema.detalle}
        </Alerta>
      )}
      {exito && <Alerta tipo="exito" onCerrar={() => setExito(null)}>{exito}</Alerta>}

      {puedeVender ? (
        <form className="tarjeta venta" onSubmit={vender}>
          <h3>Nueva venta</h3>
          <div className="fila">
            <label className="ancho">
              Medicamento
              <select value={medId} onChange={(e) => setMedId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">— Seleccione —</option>
                {meds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} · {moneda(m.precio)} · stock {m.stock}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                required
              />
            </label>
          </div>

          {med && (
            <div className="detalle-venta">
              <div>
                <small>Lote en inventario</small>
                <code>{med.loteActual}</code>
              </div>
              <div>
                <small>Disponible</small>
                <strong className={stockInsuficiente ? 'bajo' : ''}>{med.stock} uds.</strong>
              </div>
              <div>
                <small>Precio unitario</small>
                <strong>{moneda(med.precio)}</strong>
              </div>
              <div className="total">
                <small>Total</small>
                <strong>{moneda(total)}</strong>
              </div>
            </div>
          )}

          {stockInsuficiente && (
            <Alerta tipo="aviso">
              La cantidad solicitada ({cantidad}) supera el stock disponible ({med?.stock}).
            </Alerta>
          )}
          {med?.requiereCadenaFrio && (
            <Alerta tipo="info">
              Producto de cadena de frío (2–{med.temperaturaRequerida} °C): entregar con gel refrigerante.
            </Alerta>
          )}

          <button type="submit" disabled={enviando || stockInsuficiente || medId === ''}>
            {enviando ? 'Procesando…' : `Registrar venta · ${moneda(total)}`}
          </button>
          <p className="nota">
            Antes de procesar, el sistema verifica que exista un lote APROBADO por Laboratorio y descuenta el stock
            de forma transaccional.
          </p>
        </form>
      ) : (
        <Alerta tipo="info">Vista de auditoría. El registro de ventas es exclusivo del rol Ventas.</Alerta>
      )}

      <div className="encabezado">
        <h3>Historial de ventas</h3>
        <span className="chip">Hoy: {moneda(totalDia)}</span>
      </div>
      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Medicamento</th>
              <th className="num">Cantidad</th>
              <th className="num">Total</th>
              <th>Vendedor</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{fecha(v.fechaVenta)}</td>
                <td>{v.medicamentoNombre ?? `#${v.medicamentoId}`}</td>
                <td className="num">{v.cantidad}</td>
                <td className="num">{moneda(v.total)}</td>
                <td>{v.vendedorLdap}</td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={6} className="vacio">
                  Aún no hay ventas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
