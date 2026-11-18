import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaboratorioModule } from '../laboratorio/laboratorio.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { Medicamento } from './medicamento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Medicamento]), LaboratorioModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
