import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './common/health.controller';
import { SeedService } from './common/seed.service';
import { InventoryModule } from './inventory/inventory.module';
import { Medicamento } from './inventory/medicamento.entity';
import { LaboratorioModule } from './laboratorio/laboratorio.module';
import { LoteCalidad } from './laboratorio/lote-calidad.entity';
import { Venta } from './ventas/venta.entity';
import { VentasModule } from './ventas/ventas.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? '10.10.40.10',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'farmaceutica_db',
      entities: [Medicamento, LoteCalidad, Venta],
      synchronize: true,
      retryAttempts: 20,
      retryDelay: 3000,
    }),
    TypeOrmModule.forFeature([Medicamento, LoteCalidad]),
    AuthModule,
    LaboratorioModule,
    InventoryModule,
    VentasModule,
  ],
  controllers: [HealthController],
  providers: [SeedService],
})
export class AppModule {}
