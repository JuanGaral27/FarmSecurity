import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Medicamento } from '../inventory/medicamento.entity';
import { EvaluarLoteDto } from './dto/evaluar-lote.dto';
import { EstadoLote, LoteCalidad } from './lote-calidad.entity';

/** Límite inferior de la cadena de frío (2–8 °C). */
export const CADENA_FRIO_MIN = 2;

export interface LoteConMedicamento extends LoteCalidad {
  medicamentoNombre: string | null;
  requiereCadenaFrio: boolean | null;
  temperaturaRequerida: number | null;
}

@Injectable()
export class LaboratorioService {
  private readonly logger = new Logger('Laboratorio');

  constructor(
    @InjectRepository(LoteCalidad) private readonly lotes: Repository<LoteCalidad>,
    @InjectRepository(Medicamento) private readonly medicamentos: Repository<Medicamento>,
  ) {}

  async listar(): Promise<LoteConMedicamento[]> {
    const [lotes, meds] = await Promise.all([
      this.lotes.find({ order: { fechaRegistro: 'DESC' } }),
      this.medicamentos.find(),
    ]);
    const porId = new Map(meds.map((m) => [m.id, m]));
    return lotes.map((l) => {
      const m = porId.get(l.medicamentoId);
      return {
        ...l,
        medicamentoNombre: m?.nombre ?? null,
        requiereCadenaFrio: m?.requiereCadenaFrio ?? null,
        temperaturaRequerida: m?.temperaturaRequerida ?? null,
      };
    });
  }

  /** Registra un lote nuevo en cuarentena (PENDIENTE). Idempotente por código. */
  async registrarLotePendiente(
    codigoLote: string,
    medicamentoId: number,
    manager?: EntityManager,
  ): Promise<LoteCalidad> {
    const repo = manager ? manager.getRepository(LoteCalidad) : this.lotes;
    const existente = await repo.findOne({ where: { codigoLote } });
    if (existente) {
      if (existente.medicamentoId !== medicamentoId) {
        throw new ConflictException(
          `El código de lote ${codigoLote} ya pertenece a otro medicamento`,
        );
      }
      return existente;
    }
    return repo.save(
      repo.create({ codigoLote, medicamentoId, estado: EstadoLote.PENDIENTE }),
    );
  }

  /**
   * Evalúa un lote. Si se intenta APROBAR con una temperatura fuera del rango
   * permitido (excursión térmica), la aprobación se rechaza.
   */
  async evaluar(codigoLote: string, dto: EvaluarLoteDto, analista: string): Promise<LoteCalidad> {
    const lote = await this.lotes.findOne({ where: { codigoLote } });
    if (!lote) {
      throw new NotFoundException(`Lote ${codigoLote} no encontrado`);
    }
    if (lote.estado !== EstadoLote.PENDIENTE) {
      throw new ConflictException(
        `El lote ${codigoLote} ya fue evaluado (${lote.estado}) por ${lote.analistaLdap ?? 'N/D'}`,
      );
    }

    const med = await this.medicamentos.findOne({ where: { id: lote.medicamentoId } });
    if (!med) {
      throw new NotFoundException(`Medicamento ${lote.medicamentoId} asociado al lote no existe`);
    }

    if (dto.estado === EstadoLote.APROBADO) {
      const max = med.temperaturaRequerida;
      const min = med.requiereCadenaFrio ? CADENA_FRIO_MIN : -Infinity;
      if (dto.temperaturaRegistro > max || dto.temperaturaRegistro < min) {
        const rango = med.requiereCadenaFrio ? `${CADENA_FRIO_MIN}–${max} °C` : `≤ ${max} °C`;
        throw new BadRequestException(
          `Excursión térmica: ${dto.temperaturaRegistro} °C fuera del rango ${rango} para "${med.nombre}". ` +
            'El lote no puede aprobarse; debe RECHAZARSE.',
        );
      }
    }

    lote.estado = dto.estado;
    lote.temperaturaRegistro = dto.temperaturaRegistro;
    lote.observaciones = dto.observaciones ?? null;
    lote.analistaLdap = analista;
    lote.fechaEvaluacion = new Date();
    const guardado = await this.lotes.save(lote);
    this.logger.log(`Lote ${codigoLote} -> ${dto.estado} (${dto.temperaturaRegistro} °C) por ${analista}`);
    return guardado;
  }

  /** Regla crítica de trazabilidad: ¿existe al menos un lote APROBADO? */
  async tieneLoteAprobado(medicamentoId: number, manager?: EntityManager): Promise<boolean> {
    const repo = manager ? manager.getRepository(LoteCalidad) : this.lotes;
    const n = await repo.count({ where: { medicamentoId, estado: EstadoLote.APROBADO } });
    return n > 0;
  }
}
