import { useEffect, useMemo, useState } from 'react';
import { borrarSesion, cargarSesion, onSesionExpirada } from './api/client';
import Inventario from './components/Inventario';
import Laboratorio from './components/Laboratorio';
import Login from './components/Login';
import Ventas from './components/Ventas';
import { ETIQUETA_ROL, type Rol, type Sesion } from './types';

type Vista = 'inventario' | 'laboratorio' | 'ventas';

const VISTAS_POR_ROL: Record<Rol, Vista[]> = {
  almacen: ['inventario', 'laboratorio'],
  ventas: ['ventas', 'inventario'],
  laboratorio: ['laboratorio', 'inventario'],
  admin: ['inventario', 'laboratorio', 'ventas'],
};

const TITULO: Record<Vista, string> = {
  inventario: 'Inventario',
  laboratorio: 'Laboratorio',
  ventas: 'Ventas',
};

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => cargarSesion());
  const [vista, setVista] = useState<Vista>('inventario');
  const [aviso, setAviso] = useState<string | null>(null);

  const vistas = useMemo(() => (sesion ? VISTAS_POR_ROL[sesion.role] : []), [sesion]);

  useEffect(() => {
    onSesionExpirada(() => {
      setSesion(null);
      setAviso('Su sesión expiró o el token fue rechazado. Inicie sesión de nuevo.');
    });
  }, []);

  useEffect(() => {
    if (sesion && !vistas.includes(vista)) setVista(vistas[0]);
  }, [sesion, vistas, vista]);

  if (!sesion) {
    return (
      <Login
        aviso={aviso}
        onLogin={(s) => {
          setAviso(null);
          setSesion(s);
          setVista(VISTAS_POR_ROL[s.role][0]);
        }}
      />
    );
  }

  const salir = () => {
    borrarSesion();
    setSesion(null);
  };

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <span className="logo">✚</span>
          <div>
            <strong>FarmaVita</strong>
            <small>intranet.farmaceutica.local</small>
          </div>
        </div>
        <nav>
          {vistas.map((v) => (
            <button key={v} className={v === vista ? 'activo' : ''} onClick={() => setVista(v)}>
              {TITULO[v]}
            </button>
          ))}
        </nav>
        <div className="usuario">
          <div>
            <strong>{sesion.nombre || sesion.username}</strong>
            <small>
              {sesion.username} · <span className={`rol rol-${sesion.role}`}>{ETIQUETA_ROL[sesion.role]}</span>
            </small>
          </div>
          <button className="secundario" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <main>
        {vista === 'inventario' && <Inventario rol={sesion.role} />}
        {vista === 'laboratorio' && <Laboratorio rol={sesion.role} />}
        {vista === 'ventas' && <Ventas rol={sesion.role} />}
      </main>

      <footer>
        FarmaVita · Acceso controlado por OpenLDAP + JWT · Toda la actividad queda registrada
      </footer>
    </div>
  );
}
