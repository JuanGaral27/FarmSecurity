import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Medicamento } from '../inventory/medicamento.entity';
import { LaboratorioService } from '../laboratorio/laboratorio.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { Venta } from './venta.entity';

export interface VentaDetallada extends Venta {
  medicamentoNombre: string | null;
}

@Injectable()
export class VentasService {
  private readonly logger = new Logger('Ventas');

  constructor(
    @InjectRepository(Venta) private readonly ventas: Repository<Venta>,
    @InjectRepository(Medicamento) private readonly medicamentos: Repository<Medicamento>,
    private readonly laboratorio: LaboratorioService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(): Promise<VentaDetallada[]> {
    const [ventas, meds] = await Promise.all([
      this.ventas.find({ order: { fechaVenta: 'DESC' }, take: 500 }),
      this.medicamentos.find(),
    ]);
    const nombres = new Map(meds.map((m) => [m.id, m.nombre]));
    return ventas.map((v) => ({ ...v, medicamentoNombre: nombres.get(v.medicamentoId) ?? null }));
  }

  /**
   * Dispensación / venta.
   *  1) Trazabilidad: el medicamento debe tener al menos un lote APROBADO.
   *  2) Transacción con SELECT ... FOR UPDATE (pessimistic_write) sobre el
   *     medicamento para impedir saldos negativos por ventas concurrentes.
   */
  async crear(dto: CrearVentaDto, vendedor: string): Promise<VentaDetallada> {
    const existe = await this.medicamentos.exists({ where: { id: dto.medicamentoId } });
    if (!existe) {
      throw new NotFoundException(`Medicamento ${dto.medicamentoId} no encontrado`);
    }

    const aprobado = await this.laboratorio.tieneLoteAprobado(dto.medicamentoId);
    if (!aprobado) {
      this.logger.warn(`Venta bloqueada (sin lote aprobado): med ${dto.medicamentoId} por ${vendedor}`);
      throw new UnprocessableEntityException({
        statusCode: 422,
        codigo: 'LOTE_NO_APROBADO',
        message:
          'Venta bloqueada: el medicamento no tiene ningún lote APROBADO por Laboratorio (control de calidad / cadena de frío).',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const repoMed = manager.getRepository(Medicamento);
      const med = await repoMed.findOne({
        where: { id: dto.medicamentoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!med) {
        throw new NotFoundException(`Medicamento ${dto.medicamentoId} no encontrado`);
      }

      // Reverificación dentro de la transacción (por si el lote cambió de estado)
      if (!(await this.laboratorio.tieneLoteAprobado(med.id, manager))) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          codigo: 'LOTE_NO_APROBADO',
          message: 'Venta bloqueada: el medicamento no tiene ningún lote APROBADO por Laboratorio.',
        });
      }

      if (med.stock < dto.cantidad) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          codigo: 'STOCK_INSUFICIENTE',
          message: `Stock insuficiente para "${med.nombre}": disponible ${med.stock}, solicitado ${dto.cantidad}.`,
        });
      }

      med.stock -= dto.cantidad;
      await repoMed.save(med);

      const total = Math.round(med.precio * dto.cantidad * 100) / 100;
      const repoVenta = manager.getRepository(Venta);
      const venta = await repoVenta.save(
        repoVenta.create({
          medicamentoId: med.id,
          cantidad: dto.cantidad,
          total,
          vendedorLdap: vendedor,
        }),
      );

      this.logger.log(
        `Venta #${venta.id}: ${dto.cantidad} x "${med.nombre}" = ${total} por ${vendedor}. Stock restante ${med.stock}`,
      );
      return { ...venta, medicamentoNombre: med.nombre };
    });
  }
}
