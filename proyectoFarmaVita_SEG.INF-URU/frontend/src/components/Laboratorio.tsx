import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, api, fecha } from '../api/client';
import type { EstadoLote, LoteCalidad, Rol } from '../types';
import Alerta from './Alerta';

interface Props {
  rol: Rol;
}

const CADENA_FRIO_MIN = 2;

export default function Laboratorio({ rol }: Props) {
  const puedeEvaluar = rol === 'laboratorio';
  const [lotes, setLotes] = useState<LoteCalidad[]>([]);
  const [filtro, setFiltro] = useState<EstadoLote | 'TODOS'>('TODOS');
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [seleccion, setSeleccion] = useState<LoteCalidad | null>(null);
  const [temperatura, setTemperatura] = useState<number | ''>('');
  const [estado, setEstado] = useState<'APROBADO' | 'RECHAZADO'>('APROBADO');
  const [observaciones, setObservaciones] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLotes(await api.lotes());
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

  const visibles = useMemo(
    () => (filtro === 'TODOS' ? lotes : lotes.filter((l) => l.estado === filtro)),
    [lotes, filtro],
  );

  const conteo = useMemo(() => {
    const c = { PENDIENTE: 0, APROBADO: 0, RECHAZADO: 0 };
    lotes.forEach((l) => (c[l.estado] += 1));
    return c;
  }, [lotes]);

  // Validación de rango en cliente (el backend la vuelve a aplicar)
  const fueraDeRango = useMemo(() => {
    if (!seleccion || temperatura === '' || seleccion.temperaturaRequerida === null) return false;
    const max = seleccion.temperaturaRequerida;
    const min = seleccion.requiereCadenaFrio ? CADENA_FRIO_MIN : -Infinity;
    return temperatura > max || temperatura < min;
  }, [seleccion, temperatura]);

  const abrir = (l: LoteCalidad) => {
    setSeleccion(l);
    setTemperatura('');
    setEstado('APROBADO');
    setObservaciones('');
    setExito(null);
    setError(null);
  };

  const evaluar = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccion || temperatura === '') return;
    setError(null);
    try {
      const r = await api.evaluarLote(seleccion.codigoLote, {
        estado,
        temperaturaRegistro: temperatura,
        observaciones: observaciones.trim() || undefined,
      });
      setExito(`Lote ${r.codigoLote} marcado como ${r.estado} (${r.temperaturaRegistro} °C).`);
      setSeleccion(null);
      await cargar();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <section>
      <div className="encabezado">
        <h2>Control de calidad de lotes</h2>
        <button className="secundario" onClick={() => void cargar()} disabled={cargando}>
          ↻ Actualizar
        </button>
      </div>

      <div className="resumen">
        {(['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'] as const).map((f) => (
          <button key={f} className={`filtro ${filtro === f ? 'activo' : ''}`} onClick={() => setFiltro(f)}>
            {f === 'TODOS' ? `Todos (${lotes.length})` : `${f} (${conteo[f]})`}
          </button>
        ))}
      </div>

      {error && <Alerta tipo="error" onCerrar={() => setError(null)}>{error}</Alerta>}
      {exito && <Alerta tipo="exito" onCerrar={() => setExito(null)}>{exito}</Alerta>}

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Medicamento</th>
              <th>Rango</th>
              <th>Estado</th>
              <th className="num">Temp. registrada</th>
              <th>Analista</th>
              <th>Evaluación</th>
              {puedeEvaluar && <th />}
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.id} className={seleccion?.id === l.id ? 'seleccionada' : ''}>
                <td>
                  <code>{l.codigoLote}</code>
                </td>
                <td>{l.medicamentoNombre ?? `#${l.medicamentoId}`}</td>
                <td>
                  {l.requiereCadenaFrio ? (
                    <span className="chip frio">❄ 2–{l.temperaturaRequerida} °C</span>
                  ) : (
                    <span className="chip">≤ {l.temperaturaRequerida} °C</span>
                  )}
                </td>
                <td>
                  <span className={`estado estado-${l.estado.toLowerCase()}`}>{l.estado}</span>
                </td>
                <td className="num">{l.temperaturaRegistro !== null ? `${l.temperaturaRegistro} °C` : '—'}</td>
                <td>{l.analistaLdap ?? '—'}</td>
                <td>
                  {fecha(l.fechaEvaluacion)}
                  {l.observaciones && <div className="obs">{l.observaciones}</div>}
                </td>
                {puedeEvaluar && (
                  <td>
                    {l.estado === 'PENDIENTE' && (
                      <button className="pequeno" onClick={() => abrir(l)}>
                        Evaluar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!cargando && visibles.length === 0 && (
              <tr>
                <td colSpan={puedeEvaluar ? 8 : 7} className="vacio">
                  No hay lotes en este estado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {puedeEvaluar && seleccion && (
        <form className="tarjeta evaluacion" onSubmit={evaluar}>
          <h3>
            Evaluar lote <code>{seleccion.codigoLote}</code> · {seleccion.medicamentoNombre}
          </h3>
          <p className="ayuda">
            Rango permitido:{' '}
            {seleccion.requiereCadenaFrio
              ? `${CADENA_FRIO_MIN}–${seleccion.temperaturaRequerida} °C (cadena de frío)`
              : `≤ ${seleccion.temperaturaRequerida} °C`}
          </p>
          <div className="fila">
            <label>
              Temperatura registrada (°C)
              <input
                type="number"
                step={0.1}
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </label>
            <label>
              Dictamen
              <select value={estado} onChange={(e) => setEstado(e.target.value as 'APROBADO' | 'RECHAZADO')}>
                <option value="APROBADO">APROBADO</option>
                <option value="RECHAZADO">RECHAZADO</option>
              </select>
            </label>
          </div>
          {fueraDeRango && (
            <Alerta tipo="aviso">
              Excursión térmica detectada: la temperatura está fuera del rango. El sistema no permitirá APROBAR este
              lote.
            </Alerta>
          )}
          <label>
            Observaciones
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Resultados de análisis, data logger, inspección visual…"
            />
          </label>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setSeleccion(null)}>
              Cancelar
            </button>
            <button type="submit" className={estado === 'RECHAZADO' ? 'peligro' : ''}>
              Registrar dictamen
            </button>
          </div>
        </form>
      )}

      {!puedeEvaluar && (
        <Alerta tipo="info">Vista de solo lectura. La evaluación de lotes es exclusiva del rol Laboratorio.</Alerta>
      )}
    </section>
  );
}
