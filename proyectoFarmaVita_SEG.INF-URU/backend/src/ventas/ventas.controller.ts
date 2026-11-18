import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsuarioActual } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Rol, UsuarioJwt } from '../auth/roles.enum';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { VentaDetallada, VentasService } from './ventas.service';

@Controller('ventas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  @Roles(Rol.VENTAS)
  crear(@Body() dto: CrearVentaDto, @UsuarioActual() u: UsuarioJwt): Promise<VentaDetallada> {
    return this.ventas.crear(dto, u.username);
  }

  @Get()
  @Roles(Rol.VENTAS, Rol.ADMIN)
  listar(): Promise<VentaDetallada[]> {
    return this.ventas.listar();
  }
}
