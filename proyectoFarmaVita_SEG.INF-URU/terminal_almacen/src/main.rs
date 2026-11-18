//! FarmaVita · Terminal de Almacén (TUI)
//! Ejecutar dentro de pc_almacen_01:  docker exec -it pc_almacen_01 terminal_almacen

mod api;

use api::{ApiClient, ApiError, Medicamento};
use ratatui::{
    backend::CrosstermBackend,
    crossterm::{
        event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
        execute,
        terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
    },
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Cell, Clear, Paragraph, Row, Table, TableState, Wrap},
    Frame, Terminal,
};
use std::io::{self, Stdout};
use std::time::{Duration, Instant};

const REFRESCO: Duration = Duration::from_secs(5);
const VERDE: Color = Color::Rgb(20, 184, 166);

#[derive(PartialEq, Eq, Clone, Copy)]
enum Pantalla {
    Login,
    Inventario,
    Ingreso,
}

#[derive(Clone, Copy)]
enum Nivel {
    Info,
    Exito,
    Error,
}

struct App {
    api: ApiClient,
    pantalla: Pantalla,
    // Login
    usuario: String,
    clave: String,
    campo_login: usize,
    // Sesión
    token: Option<String>,
    username: String,
    nombre: String,
    // Inventario
    meds: Vec<Medicamento>,
    tabla: TableState,
    ultima_actualizacion: Option<Instant>,
    // Ingreso
    ingreso_cantidad: String,
    ingreso_lote: String,
    campo_ingreso: usize,
    // Estado
    mensaje: Option<(String, Nivel)>,
    salir: bool,
}

impl App {
    fn new(api: ApiClient) -> Self {
        Self {
            api,
            pantalla: Pantalla::Login,
            usuario: String::new(),
            clave: String::new(),
            campo_login: 0,
            token: None,
            username: String::new(),
            nombre: String::new(),
            meds: Vec::new(),
            tabla: TableState::default(),
            ultima_actualizacion: None,
            ingreso_cantidad: String::new(),
            ingreso_lote: String::new(),
            campo_ingreso: 0,
            mensaje: Some((
                "Ingrese sus credenciales LDAP de almacén. [Tab] cambia de campo · [Enter] entra · [Esc] sale".into(),
                Nivel::Info,
            )),
            salir: false,
        }
    }

    fn info(&mut self, m: impl Into<String>, n: Nivel) {
        self.mensaje = Some((m.into(), n));
    }

    fn cerrar_sesion(&mut self, motivo: &str) {
        self.token = None;
        self.clave.clear();
        self.meds.clear();
        self.pantalla = Pantalla::Login;
        self.campo_login = 1;
        self.info(motivo.to_string(), Nivel::Error);
    }

    fn manejar_error(&mut self, e: ApiError) {
        match e {
            ApiError::NoAutorizado(_) if self.token.is_some() => {
                self.cerrar_sesion("La sesión expiró o el token fue rechazado. Inicie sesión de nuevo.")
            }
            otro => self.info(otro.to_string(), Nivel::Error),
        }
    }

    // ------------------------------------------------------------------
    fn login(&mut self) {
        if self.usuario.trim().is_empty() || self.clave.is_empty() {
            self.info("Usuario y contraseña son obligatorios.", Nivel::Error);
            return;
        }
        match self.api.login(self.usuario.trim(), &self.clave) {
            Ok(s) => {
                self.clave.clear();
                if s.role != "almacen" {
                    self.info(
                        format!(
                            "El usuario '{}' tiene rol '{}'. Esta terminal es exclusiva del rol almacen.",
                            s.username, s.role
                        ),
                        Nivel::Error,
                    );
                    return;
                }
                self.token = Some(s.access_token);
                self.username = s.username;
                self.nombre = s.nombre;
                self.pantalla = Pantalla::Inventario;
                self.info(format!("Bienvenido, {}. Sesión JWT iniciada.", self.nombre), Nivel::Exito);
                self.refrescar(true);
            }
            Err(e) => {
                self.clave.clear();
                self.info(e.to_string(), Nivel::Error);
            }
        }
    }

    fn refrescar(&mut self, avisar: bool) {
        let Some(token) = self.token.clone() else { return };
        match self.api.medicamentos(&token) {
            Ok(meds) => {
                let sel = self.tabla.selected().unwrap_or(0);
                self.meds = meds;
                if self.meds.is_empty() {
                    self.tabla.select(None);
                } else {
                    self.tabla.select(Some(sel.min(self.meds.len() - 1)));
                }
                self.ultima_actualizacion = Some(Instant::now());
                if avisar {
                    self.info(format!("Inventario actualizado: {} medicamentos.", self.meds.len()), Nivel::Info);
                }
            }
            Err(e) => {
                self.ultima_actualizacion = Some(Instant::now());
                self.manejar_error(e)
            }
        }
    }

    fn seleccionado(&self) -> Option<&Medicamento> {
        self.tabla.selected().and_then(|i| self.meds.get(i))
    }

    fn mover(&mut self, delta: i64) {
        if self.meds.is_empty() {
            return;
        }
        let n = self.meds.len() as i64;
        let actual = self.tabla.selected().unwrap_or(0) as i64;
        self.tabla.select(Some(((actual + delta).rem_euclid(n)) as usize));
    }

    fn registrar_ingreso(&mut self) {
        let Some(token) = self.token.clone() else { return };
        let Some(med) = self.seleccionado().cloned() else { return };
        let cantidad: i64 = match self.ingreso_cantidad.parse() {
            Ok(c) if c > 0 => c,
            _ => {
                self.info("La cantidad debe ser un entero mayor que 0.", Nivel::Error);
                return;
            }
        };
        let lote = self.ingreso_lote.trim().to_uppercase();
        let lote_opt = if lote.is_empty() { None } else { Some(lote.as_str()) };
        if let Some(l) = lote_opt {
            let valido = l.len() >= 3 && l.len() <= 60 && l.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '-');
            if !valido {
                self.info("Lote inválido: use MAYÚSCULAS, dígitos y guiones (3-60).", Nivel::Error);
                return;
            }
        }

        match self.api.ingreso(&token, med.id, cantidad, lote_opt) {
            Ok(m) => {
                let extra = if lote_opt.is_some() {
                    format!(" Lote {} en cuarentena (PENDIENTE de Laboratorio).", m.lote_actual)
                } else {
                    String::new()
                };
                self.info(
                    format!("Ingreso registrado: +{} de \"{}\". Stock actual: {}.{}", cantidad, m.nombre, m.stock, extra),
                    Nivel::Exito,
                );
                self.ingreso_cantidad.clear();
                self.ingreso_lote.clear();
                self.pantalla = Pantalla::Inventario;
                self.refrescar(false);
            }
            Err(e) => self.manejar_error(e),
        }
    }

    // ------------------------------------------------------------------
    fn tecla(&mut self, k: KeyEvent) {
        if k.modifiers.contains(KeyModifiers::CONTROL) && k.code == KeyCode::Char('c') {
            self.salir = true;
            return;
        }
        match self.pantalla {
            Pantalla::Login => self.tecla_login(k),
            Pantalla::Inventario => self.tecla_inventario(k),
            Pantalla::Ingreso => self.tecla_ingreso(k),
        }
    }

    fn tecla_login(&mut self, k: KeyEvent) {
        match k.code {
            KeyCode::Esc => self.salir = true,
            KeyCode::Tab | KeyCode::Down | KeyCode::Up | KeyCode::BackTab => self.campo_login ^= 1,
            KeyCode::Enter => {
                if self.campo_login == 0 {
                    self.campo_login = 1;
                } else {
                    self.login();
                }
            }
            KeyCode::Backspace => {
                if self.campo_login == 0 {
                    self.usuario.pop();
                } else {
                    self.clave.pop();
                }
            }
            KeyCode::Char(c) => {
                if self.campo_login == 0 {
                    if self.usuario.len() < 64 && (c.is_ascii_alphanumeric() || "._-".contains(c)) {
                        self.usuario.push(c);
                    }
                } else if self.clave.len() < 128 {
                    self.clave.push(c);
                }
            }
            _ => {}
        }
    }

    fn tecla_inventario(&mut self, k: KeyEvent) {
        match k.code {
            KeyCode::Char('q') | KeyCode::Esc => self.salir = true,
            KeyCode::Char('l') => self.cerrar_sesion("Sesión cerrada por el usuario."),
            KeyCode::Down | KeyCode::Char('j') => self.mover(1),
            KeyCode::Up | KeyCode::Char('k') => self.mover(-1),
            KeyCode::PageDown => self.mover(5),
            KeyCode::PageUp => self.mover(-5),
            KeyCode::Char('r') | KeyCode::F(5) => self.refrescar(true),
            KeyCode::Char('i') | KeyCode::Enter => {
                if self.seleccionado().is_some() {
                    self.ingreso_cantidad.clear();
                    self.ingreso_lote.clear();
                    self.campo_ingreso = 0;
                    self.pantalla = Pantalla::Ingreso;
                    self.info("Ingreso de mercancía: [Tab] cambia de campo · [Enter] confirma · [Esc] cancela", Nivel::Info);
                }
            }
            _ => {}
        }
    }

    fn tecla_ingreso(&mut self, k: KeyEvent) {
        match k.code {
            KeyCode::Esc => {
                self.pantalla = Pantalla::Inventario;
                self.info("Ingreso cancelado.", Nivel::Info);
            }
            KeyCode::Tab | KeyCode::Down | KeyCode::Up | KeyCode::BackTab => self.campo_ingreso ^= 1,
            KeyCode::Enter => self.registrar_ingreso(),
            KeyCode::Backspace => {
                if self.campo_ingreso == 0 {
                    self.ingreso_cantidad.pop();
                } else {
                    self.ingreso_lote.pop();
                }
            }
            KeyCode::Char(c) => {
                if self.campo_ingreso == 0 {
                    if c.is_ascii_digit() && self.ingreso_cantidad.len() < 7 {
                        self.ingreso_cantidad.push(c);
                    }
                } else if (c.is_ascii_alphanumeric() || c == '-') && self.ingreso_lote.len() < 60 {
                    self.ingreso_lote.push(c.to_ascii_uppercase());
                }
            }
            _ => {}
        }
    }
}

// ======================================================================
//  Interfaz
// ======================================================================

fn centrado(ancho: u16, alto: u16, r: Rect) -> Rect {
    let w = ancho.min(r.width);
    let h = alto.min(r.height);
    Rect { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h }
}

fn bloque(titulo: &str) -> Block<'_> {
    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(VERDE))
        .title(Span::styled(format!(" {titulo} "), Style::default().fg(VERDE).add_modifier(Modifier::BOLD)))
}

fn campo<'a>(etiqueta: &'a str, valor: String, activo: bool) -> Paragraph<'a> {
    let estilo = if activo {
        Style::default().fg(Color::Black).bg(VERDE)
    } else {
        Style::default().fg(Color::White).bg(Color::DarkGray)
    };
    let cursor = if activo { "▏" } else { "" };
    Paragraph::new(Line::from(vec![
        Span::styled(format!("{etiqueta:<14}"), Style::default().fg(Color::Gray)),
        Span::styled(format!(" {valor}{cursor} "), estilo),
    ]))
}

fn ui(f: &mut Frame, app: &mut App) {
    let zonas = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(5), Constraint::Length(3), Constraint::Length(1)])
        .split(f.area());

    // Cabecera
    let usuario = if app.token.is_some() {
        format!("{} ({}) · rol almacen", app.nombre, app.username)
    } else {
        "sin sesión".to_string()
    };
    let cab = Paragraph::new(Line::from(vec![
        Span::styled(" ✚ FarmaVita ", Style::default().fg(Color::Black).bg(VERDE).add_modifier(Modifier::BOLD)),
        Span::raw("  Terminal de Almacén · pc_almacen_01 · VLAN 210   "),
        Span::styled(usuario, Style::default().fg(Color::Yellow)),
    ]))
    .block(Block::default().borders(Borders::BOTTOM).border_style(Style::default().fg(Color::DarkGray)));
    f.render_widget(cab, zonas[0]);

    match app.pantalla {
        Pantalla::Login => ui_login(f, app, zonas[1]),
        Pantalla::Inventario => ui_inventario(f, app, zonas[1]),
        Pantalla::Ingreso => {
            ui_inventario(f, app, zonas[1]);
            ui_ingreso(f, app, zonas[1]);
        }
    }

    // Mensajes
    if let Some((msg, nivel)) = &app.mensaje {
        let color = match nivel {
            Nivel::Info => Color::Cyan,
            Nivel::Exito => Color::Green,
            Nivel::Error => Color::Red,
        };
        let p = Paragraph::new(msg.as_str())
            .style(Style::default().fg(color))
            .wrap(Wrap { trim: true })
            .block(Block::default().borders(Borders::TOP).border_style(Style::default().fg(Color::DarkGray)));
        f.render_widget(p, zonas[2]);
    }

    // Ayuda
    let ayuda = match app.pantalla {
        Pantalla::Login => " Tab: campo · Enter: entrar · Esc: salir",
        Pantalla::Inventario => " ↑↓/jk: mover · i/Enter: ingreso · r: actualizar · l: cerrar sesión · q: salir",
        Pantalla::Ingreso => " Tab: campo · Enter: confirmar · Esc: cancelar",
    };
    let destino = format!("API {} (Host: {}) ", app.api.base(), app.api.host());
    let ancho = zonas[3].width as usize;
    let relleno = ancho.saturating_sub(ayuda.chars().count() + destino.chars().count());
    f.render_widget(
        Paragraph::new(format!("{ayuda}{}{destino}", " ".repeat(relleno)))
            .style(Style::default().fg(Color::Black).bg(Color::Gray)),
        zonas[3],
    );
}

fn ui_login(f: &mut Frame, app: &App, area: Rect) {
    let caja = centrado(60, 11, area);
    f.render_widget(Clear, caja);
    f.render_widget(bloque("Inicio de sesión · OpenLDAP dc=farmaceutica,dc=local"), caja);
    let filas = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([Constraint::Length(1), Constraint::Length(1), Constraint::Length(1), Constraint::Length(1), Constraint::Min(1)])
        .split(caja);
    f.render_widget(campo("Usuario", app.usuario.clone(), app.campo_login == 0), filas[0]);
    f.render_widget(campo("Contraseña", "•".repeat(app.clave.chars().count()), app.campo_login == 1), filas[2]);
    f.render_widget(
        Paragraph::new("Sólo usuarios del grupo cn=almacen pueden operar esta terminal.")
            .style(Style::default().fg(Color::DarkGray))
            .alignment(Alignment::Center),
        filas[4],
    );
}

fn ui_inventario(f: &mut Frame, app: &mut App, area: Rect) {
    let partes = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(5), Constraint::Length(4)])
        .split(area);

    let cabecera = Row::new(["ID", "Medicamento", "Lote actual", "Stock", "Precio", "Conservación"])
        .style(Style::default().fg(VERDE).add_modifier(Modifier::BOLD))
        .bottom_margin(1);

    let filas: Vec<Row> = app
        .meds
        .iter()
        .map(|m| {
            let stock_estilo = if m.stock < 50 {
                Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            let conserv = if m.requiere_cadena_frio {
                Cell::from(format!("❄ 2–{} °C", m.temperatura_requerida)).style(Style::default().fg(Color::LightBlue))
            } else {
                Cell::from(format!("≤ {} °C", m.temperatura_requerida))
            };
            Row::new(vec![
                Cell::from(m.id.to_string()),
                Cell::from(m.nombre.clone()),
                Cell::from(m.lote_actual.clone()).style(Style::default().fg(Color::Yellow)),
                Cell::from(format!("{:>7}", m.stock)).style(stock_estilo),
                Cell::from(format!("{:>9.2}", m.precio)),
                conserv,
            ])
        })
        .collect();

    let segs = app.ultima_actualizacion.map(|t| t.elapsed().as_secs()).unwrap_or(0);
    let titulo = format!("Inventario en tiempo real · {} ítems · actualizado hace {}s", app.meds.len(), segs);
    let tabla = Table::new(
        filas,
        [
            Constraint::Length(4),
            Constraint::Percentage(38),
            Constraint::Length(18),
            Constraint::Length(8),
            Constraint::Length(10),
            Constraint::Min(14),
        ],
    )
    .header(cabecera)
    .block(bloque(&titulo))
    .highlight_style(Style::default().bg(Color::Rgb(19, 78, 74)).add_modifier(Modifier::BOLD))
    .highlight_symbol("▶ ");
    f.render_stateful_widget(tabla, partes[0], &mut app.tabla);

    let detalle = match app.seleccionado() {
        Some(m) => vec![
            Line::from(vec![
                Span::styled("Principio activo: ", Style::default().fg(Color::Gray)),
                Span::raw(m.principio_activo.clone()),
            ]),
            Line::from(vec![
                Span::styled("Valor en stock: ", Style::default().fg(Color::Gray)),
                Span::raw(format!("{:.2} USD", m.precio * m.stock as f64)),
                Span::styled(
                    if m.requiere_cadena_frio { "   · Almacenar en cámara fría" } else { "" },
                    Style::default().fg(Color::LightBlue),
                ),
            ]),
        ],
        None => vec![Line::from("Sin selección")],
    };
    f.render_widget(Paragraph::new(detalle).block(bloque("Detalle")), partes[1]);
}

fn ui_ingreso(f: &mut Frame, app: &App, area: Rect) {
    let Some(med) = app.seleccionado() else { return };
    let caja = centrado(64, 12, area);
    f.render_widget(Clear, caja);
    f.render_widget(bloque("Registrar ingreso de mercancía"), caja);
    let filas = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(1),
        ])
        .split(caja);
    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(med.nombre.clone(), Style::default().add_modifier(Modifier::BOLD)),
            Span::styled(format!("  (stock {} · lote {})", med.stock, med.lote_actual), Style::default().fg(Color::Gray)),
        ])),
        filas[0],
    );
    f.render_widget(campo("Cantidad", app.ingreso_cantidad.clone(), app.campo_ingreso == 0), filas[2]);
    f.render_widget(campo("Nuevo lote", app.ingreso_lote.clone(), app.campo_ingreso == 1), filas[4]);
    f.render_widget(
        Paragraph::new("Lote vacío = mismo lote. Un lote nuevo queda PENDIENTE hasta la aprobación de Laboratorio.")
            .style(Style::default().fg(Color::DarkGray))
            .wrap(Wrap { trim: true }),
        filas[6],
    );
}

// ======================================================================
//  Bucle principal
// ======================================================================

fn iniciar_terminal() -> io::Result<Terminal<CrosstermBackend<Stdout>>> {
    enable_raw_mode()?;
    let mut out = io::stdout();
    execute!(out, EnterAlternateScreen)?;
    Terminal::new(CrosstermBackend::new(out))
}

fn restaurar_terminal() {
    let _ = disable_raw_mode();
    let _ = execute!(io::stdout(), LeaveAlternateScreen);
}

fn main() -> io::Result<()> {
    let base = std::env::var("FARMA_API_URL").unwrap_or_else(|_| "http://10.10.20.10/api".into());
    let host = std::env::var("FARMA_HOST").unwrap_or_else(|_| "intranet.farmaceutica.local".into());

    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        restaurar_terminal();
        hook(info);
    }));

    let mut terminal = iniciar_terminal()?;
    let mut app = App::new(ApiClient::new(base, host));

    let resultado = (|| -> io::Result<()> {
        while !app.salir {
            terminal.draw(|f| ui(f, &mut app))?;

            if event::poll(Duration::from_millis(250))? {
                if let Event::Key(k) = event::read()? {
                    if k.kind == KeyEventKind::Press {
                        app.tecla(k);
                    }
                }
            }

            // Refresco automático del inventario
            if app.pantalla == Pantalla::Inventario {
                let vencido = app.ultima_actualizacion.map(|t| t.elapsed() >= REFRESCO).unwrap_or(true);
                if vencido {
                    app.refrescar(false);
                }
            }
        }
        Ok(())
    })();

    restaurar_terminal();
    terminal.show_cursor()?;
    resultado
}
