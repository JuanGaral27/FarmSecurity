import { useState, type FormEvent } from 'react';
import { ApiError, api, guardarSesion } from '../api/client';
import type { Sesion } from '../types';
import Alerta from './Alerta';

interface Props {
  aviso: string | null;
  onLogin: (s: Sesion) => void;
}

export default function Login({ aviso, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await api.login(username.trim(), password);
      const sesion: Sesion = { token: r.access_token, username: r.username, nombre: r.nombre, role: r.role };
      guardarSesion(sesion);
      setPassword('');
      onLogin(sesion);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-fondo">
      <form className="login-tarjeta" onSubmit={enviar}>
        <div className="login-marca">
          <span className="logo grande">✚</span>
          <h1>FarmaVita</h1>
          <p>Distribuidora y Laboratorio Farmacéutico</p>
        </div>

        {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}
        {error && <Alerta tipo="error">{error}</Alerta>}

        <label>
          Usuario corporativo (LDAP)
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="p. ej. farmaceutico1"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={cargando}>
          {cargando ? 'Verificando en el directorio…' : 'Iniciar sesión'}
        </button>
        <p className="nota">
          Autenticación contra <code>dc=farmaceutica,dc=local</code>. El acceso a cada módulo depende del grupo
          LDAP del usuario.
        </p>
      </form>
    </div>
  );
}
