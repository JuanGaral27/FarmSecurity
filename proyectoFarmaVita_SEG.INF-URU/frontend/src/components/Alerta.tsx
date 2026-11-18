interface Props {
  tipo: 'error' | 'exito' | 'aviso' | 'info';
  children: React.ReactNode;
  onCerrar?: () => void;
}

const ICONO = { error: '⛔', exito: '✔', aviso: '⚠', info: 'ℹ' } as const;

export default function Alerta({ tipo, children, onCerrar }: Props) {
  return (
    <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span className="alerta-icono">{ICONO[tipo]}</span>
      <div className="alerta-texto">{children}</div>
      {onCerrar && (
        <button className="alerta-cerrar" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
