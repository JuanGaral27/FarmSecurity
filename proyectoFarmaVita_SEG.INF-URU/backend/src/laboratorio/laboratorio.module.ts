import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medicamento } from '../inventory/medicamento.entity';
import { LaboratorioController } from './laboratorio.controller';
import { LaboratorioService } from './laboratorio.service';
import { LoteCalidad } from './lote-calidad.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoteCalidad, Medicamento])],
  controllers: [LaboratorioController],
  providers: [LaboratorioService],
  exports: [LaboratorioService],
})
export class LaboratorioModule {}
