import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LaboratorioService } from '../laboratorio/laboratorio.service';
import { CrearMedicamentoDto } from './dto/crear-medicamento.dto';
import { IngresoStockDto } from './dto/ingreso-stock.dto';
import { Medicamento } from './medicamento.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger('Inventario');

  constructor(
    @InjectRepository(Medicamento) private readonly medicamentos: Repository<Medicamento>,
    private readonly laboratorio: LaboratorioService,
    private readonly dataSource: DataSource,
  ) {}

  listar(): Promise<Medicamento[]> {
    return this.medicamentos.find({ order: { id: 'ASC' } });
  }

  async obtener(id: number): Promise<Medicamento> {
    const med = await this.medicamentos.findOne({ where: { id } });
    if (!med) throw new NotFoundException(`Medicamento ${id} no encontrado`);
    return med;
  }

  /** Alta de medicamento: su lote inicial entra en cuarentena (PENDIENTE). */
  async crear(dto: CrearMedicamentoDto, usuario: string): Promise<Medicamento> {
    const duplicado = await this.medicamentos.findOne({ where: { nombre: dto.nombre } });
    if (duplicado) {
      throw new ConflictException(`Ya existe un medicamento llamado "${dto.nombre}"`);
    }
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Medicamento);
      const med = await repo.save(repo.create(dto));
      await this.laboratorio.registrarLotePendiente(dto.loteActual, med.id, manager);
      this.logger.log(`Alta de "${med.nombre}" (lote ${med.loteActual}) por ${usuario}`);
      return med;
    });
  }

  /** Ingreso de mercancía con bloqueo pesimista sobre la fila del medicamento. */
  async ingresar(id: number, dto: IngresoStockDto, usuario: string): Promise<Medicamento> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Medicamento);
      const med = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!med) throw new NotFoundException(`Medicamento ${id} no encontrado`);

      if (dto.lote && dto.lote !== med.loteActual) {
        await this.laboratorio.registrarLotePendiente(dto.lote, med.id, manager);
        med.loteActual = dto.lote;
      }
      med.stock += dto.cantidad;
      const guardado = await repo.save(med);
      this.logger.log(
        `Ingreso +${dto.cantidad} de "${med.nombre}" (lote ${med.loteActual}) por ${usuario}. Stock: ${med.stock}`,
      );
      return guardado;
    });
  }
}
