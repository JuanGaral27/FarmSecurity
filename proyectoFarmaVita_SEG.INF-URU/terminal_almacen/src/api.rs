//! Cliente HTTP de la API FarmaVita a través del proxy de la DMZ.
//! Todas las peticiones se envían a 10.10.20.10 con la cabecera
//! `Host: intranet.farmaceutica.local` (virtual host de Nginx).

use serde::Deserialize;
use serde_json::json;
use std::time::Duration;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Medicamento {
    pub id: i64,
    pub nombre: String,
    pub principio_activo: String,
    pub lote_actual: String,
    pub stock: i64,
    pub precio: f64,
    pub temperatura_requerida: f64,
    pub requiere_cadena_frio: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Sesion {
    pub access_token: String,
    pub username: String,
    #[serde(default)]
    pub nombre: String,
    pub role: String,
}

#[derive(Debug)]
pub enum ApiError {
    /// 401: credenciales inválidas o token expirado
    NoAutorizado(String),
    /// 403: rol sin permiso
    Prohibido(String),
    /// Otro error HTTP con mensaje del backend
    Http(u16, String),
    /// Error de red (firewall, proxy caído, timeout)
    Red(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::NoAutorizado(m) => write!(f, "No autorizado: {m}"),
            ApiError::Prohibido(m) => write!(f, "Acceso denegado: {m}"),
            ApiError::Http(c, m) => write!(f, "Error {c}: {m}"),
            ApiError::Red(m) => write!(f, "Error de red: {m}"),
        }
    }
}

pub struct ApiClient {
    agent: ureq::Agent,
    base: String,
    host: String,
}

impl ApiClient {
    pub fn new(base: String, host: String) -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(4))
            .timeout(Duration::from_secs(8))
            .user_agent("FarmaVita-TerminalAlmacen/1.0")
            .build();
        Self { agent, base: base.trim_end_matches('/').to_string(), host }
    }

    pub fn base(&self) -> &str {
        &self.base
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    fn req(&self, metodo: &str, ruta: &str, token: Option<&str>) -> ureq::Request {
        let mut r = self
            .agent
            .request(metodo, &format!("{}{}", self.base, ruta))
            .set("Host", &self.host)
            .set("Accept", "application/json");
        if let Some(t) = token {
            r = r.set("Authorization", &format!("Bearer {t}"));
        }
        r
    }

    fn convertir_error(e: ureq::Error) -> ApiError {
        match e {
            ureq::Error::Status(code, resp) => {
                let texto = resp.into_string().unwrap_or_default();
                let msg = serde_json::from_str::<serde_json::Value>(&texto)
                    .ok()
                    .and_then(|v| match v.get("message") {
                        Some(serde_json::Value::String(s)) => Some(s.clone()),
                        Some(serde_json::Value::Array(a)) => Some(
                            a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join(" · "),
                        ),
                        _ => None,
                    })
                    .unwrap_or_else(|| if texto.is_empty() { "sin detalle".into() } else { texto });
                match code {
                    401 => ApiError::NoAutorizado(msg),
                    403 => ApiError::Prohibido(msg),
                    429 => ApiError::Http(code, "Demasiados intentos, espere un minuto".into()),
                    _ => ApiError::Http(code, msg),
                }
            }
            ureq::Error::Transport(t) => ApiError::Red(t.to_string()),
        }
    }

    pub fn login(&self, usuario: &str, clave: &str) -> Result<Sesion, ApiError> {
        self.req("POST", "/auth/login", None)
            .send_json(json!({ "username": usuario, "password": clave }))
            .map_err(Self::convertir_error)?
            .into_json::<Sesion>()
            .map_err(|e| ApiError::Red(format!("respuesta inválida: {e}")))
    }

    pub fn medicamentos(&self, token: &str) -> Result<Vec<Medicamento>, ApiError> {
        self.req("GET", "/inventario/medicamentos", Some(token))
            .call()
            .map_err(Self::convertir_error)?
            .into_json::<Vec<Medicamento>>()
            .map_err(|e| ApiError::Red(format!("respuesta inválida: {e}")))
    }

    pub fn ingreso(
        &self,
        token: &str,
        id: i64,
        cantidad: i64,
        lote: Option<&str>,
    ) -> Result<Medicamento, ApiError> {
        let cuerpo = match lote {
            Some(l) => json!({ "cantidad": cantidad, "lote": l }),
            None => json!({ "cantidad": cantidad }),
        };
        self.req("POST", &format!("/inventario/medicamentos/{id}/ingreso"), Some(token))
            .send_json(cuerpo)
            .map_err(Self::convertir_error)?
            .into_json::<Medicamento>()
            .map_err(|e| ApiError::Red(format!("respuesta inválida: {e}")))
    }
}
