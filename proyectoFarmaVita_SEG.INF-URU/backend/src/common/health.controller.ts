import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async estado(): Promise<{ estado: string; baseDatos: boolean; fecha: string }> {
    let baseDatos = false;
    try {
      await this.dataSource.query('SELECT 1');
      baseDatos = true;
    } catch {
      baseDatos = false;
    }
    return { estado: 'ok', baseDatos, fecha: new Date().toISOString() };
  }
}
