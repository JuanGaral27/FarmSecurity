import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioActual } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Rol, UsuarioJwt } from '../auth/roles.enum';
import { CrearMedicamentoDto } from './dto/crear-medicamento.dto';
import { IngresoStockDto } from './dto/ingreso-stock.dto';
import { InventoryService } from './inventory.service';
import { Medicamento } from './medicamento.entity';

@Controller('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventario: InventoryService) {}

  @Get('medicamentos')
  @Roles(Rol.ALMACEN, Rol.VENTAS, Rol.LABORATORIO, Rol.ADMIN)
  listar(): Promise<Medicamento[]> {
    return this.inventario.listar();
  }

  @Get('medicamentos/:id')
  @Roles(Rol.ALMACEN, Rol.VENTAS, Rol.LABORATORIO, Rol.ADMIN)
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Medicamento> {
    return this.inventario.obtener(id);
  }

  @Post('medicamentos')
  @Roles(Rol.ALMACEN)
  crear(@Body() dto: CrearMedicamentoDto, @UsuarioActual() u: UsuarioJwt): Promise<Medicamento> {
    return this.inventario.crear(dto, u.username);
  }

  @Post('medicamentos/:id/ingreso')
  @Roles(Rol.ALMACEN)
  ingresar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IngresoStockDto,
    @UsuarioActual() u: UsuarioJwt,
  ): Promise<Medicamento> {
    return this.inventario.ingresar(id, dto, u.username);
  }
}
