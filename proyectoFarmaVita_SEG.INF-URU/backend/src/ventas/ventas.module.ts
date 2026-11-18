import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medicamento } from '../inventory/medicamento.entity';
import { LaboratorioModule } from '../laboratorio/laboratorio.module';
import { Venta } from './venta.entity';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venta, Medicamento]), LaboratorioModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
