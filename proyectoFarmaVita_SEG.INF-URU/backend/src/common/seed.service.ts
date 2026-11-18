import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Medicamento } from '../inventory/medicamento.entity';
import { EstadoLote, LoteCalidad } from '../laboratorio/lote-calidad.entity';

interface SemillaMedicamento {
  nombre: string;
  principioActivo: string;
  loteActual: string;
  stock: number;
  precio: number;
  temperaturaRequerida: number;
  requiereCadenaFrio: boolean;
  estadoLote: EstadoLote;
  temperaturaRegistro: number | null;
  observaciones: string | null;
}

const SEMILLAS: SemillaMedicamento[] = [
  {
    nombre: 'Acetaminofén 500 mg (caja x20)',
    principioActivo: 'Paracetamol',
    loteActual: 'LT-ACE-2026-001',
    stock: 500,
    precio: 3.5,
    temperaturaRequerida: 25,
    requiereCadenaFrio: false,
    estadoLote: EstadoLote.APROBADO,
    temperaturaRegistro: 22.4,
    observaciones: 'Lote conforme. Disolución y valoración dentro de especificación.',
  },
  {
    nombre: 'Amoxicilina 500 mg (caja x21)',
    principioActivo: 'Amoxicilina trihidrato',
    loteActual: 'LT-AMX-2026-014',
    stock: 240,
    precio: 7.8,
    temperaturaRequerida: 25,
    requiereCadenaFrio: false,
    estadoLote: EstadoLote.APROBADO,
    temperaturaRegistro: 23.1,
    observaciones: 'Lote conforme.',
  },
  {
    nombre: 'Insulina Glargina 100 UI/ml (pluma)',
    principioActivo: 'Insulina glargina',
    loteActual: 'LT-INS-2026-007',
    stock: 60,
    precio: 42.0,
    temperaturaRequerida: 8,
    requiereCadenaFrio: true,
    estadoLote: EstadoLote.APROBADO,
    temperaturaRegistro: 4.6,
    observaciones: 'Cadena de frío verificada con data logger (2-8 °C).',
  },
  {
    nombre: 'Vacuna Antitetánica 0,5 ml',
    principioActivo: 'Toxoide tetánico',
    loteActual: 'LT-VAC-2026-003',
    stock: 120,
    precio: 15.0,
    temperaturaRequerida: 8,
    requiereCadenaFrio: true,
    estadoLote: EstadoLote.PENDIENTE,
    temperaturaRegistro: null,
    observaciones: null,
  },
  {
    nombre: 'Ibuprofeno 400 mg (caja x10)',
    principioActivo: 'Ibuprofeno',
    loteActual: 'LT-IBU-2026-022',
    stock: 300,
    precio: 4.2,
    temperaturaRequerida: 30,
    requiereCadenaFrio: false,
    estadoLote: EstadoLote.RECHAZADO,
    temperaturaRegistro: 34.8,
    observaciones: 'Excursión térmica en transporte. Lote retenido.',
  },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Medicamento) private readonly medicamentos: Repository<Medicamento>,
    @InjectRepository(LoteCalidad) private readonly lotes: Repository<LoteCalidad>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sembrarDatos();
    await this.enlazarAuditoria();
  }

  private async sembrarDatos(): Promise<void> {
    const total = await this.medicamentos.count();
    if (total > 0) {
      this.logger.log(`Base de datos con ${total} medicamentos: no se siembra.`);
      return;
    }

    for (const s of SEMILLAS) {
      const med = await this.medicamentos.save(
        this.medicamentos.create({
          nombre: s.nombre,
          principioActivo: s.principioActivo,
          loteActual: s.loteActual,
          stock: s.stock,
          precio: s.precio,
          temperaturaRequerida: s.temperaturaRequerida,
          requiereCadenaFrio: s.requiereCadenaFrio,
        }),
      );
      const evaluado = s.estadoLote !== EstadoLote.PENDIENTE;
      await this.lotes.save(
        this.lotes.create({
          codigoLote: s.loteActual,
          medicamentoId: med.id,
          estado: s.estadoLote,
          temperaturaRegistro: s.temperaturaRegistro,
          observaciones: s.observaciones,
          analistaLdap: evaluado ? 'laboratorista1' : null,
          fechaEvaluacion: evaluado ? new Date() : null,
        }),
      );
    }
    this.logger.log(`Datos semilla cargados: ${SEMILLAS.length} medicamentos y lotes.`);
  }

  /** Enlaza los disparadores del esquema auditoria (db/init/01_hardening.sql). */
  private async enlazarAuditoria(): Promise<void> {
    try {
      const existe = await this.dataSource.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'auditoria' AND p.proname = 'registrar'`,
      );
      if (!existe.length) {
        this.logger.warn('Función auditoria.registrar() no encontrada; auditoría omitida.');
        return;
      }
      for (const tabla of ['medicamentos', 'lotes_calidad', 'ventas']) {
        await this.dataSource.query(
          `CREATE OR REPLACE TRIGGER trg_auditoria_${tabla}
             AFTER INSERT OR UPDATE OR DELETE ON "${tabla}"
             FOR EACH ROW EXECUTE FUNCTION auditoria.registrar()`,
        );
      }
      this.logger.log('Disparadores de auditoría enlazados.');
    } catch (err) {
      this.logger.warn(`No se pudo enlazar la auditoría: ${(err as Error).message}`);
    }
  }
}
