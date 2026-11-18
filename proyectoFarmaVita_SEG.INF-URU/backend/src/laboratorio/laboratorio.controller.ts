import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { UsuarioActual } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Rol, UsuarioJwt } from '../auth/roles.enum';
import { EvaluarLoteDto } from './dto/evaluar-lote.dto';
import { LaboratorioService, LoteConMedicamento } from './laboratorio.service';
import { LoteCalidad } from './lote-calidad.entity';

@Controller('laboratorio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaboratorioController {
  constructor(private readonly laboratorio: LaboratorioService) {}

  @Get('lotes')
  @Roles(Rol.LABORATORIO, Rol.ALMACEN, Rol.ADMIN)
  listar(): Promise<LoteConMedicamento[]> {
    return this.laboratorio.listar();
  }

  @Post('lotes/:codigoLote/evaluar')
  @HttpCode(200)
  @Roles(Rol.LABORATORIO)
  evaluar(
    @Param('codigoLote') codigoLote: string,
    @Body() dto: EvaluarLoteDto,
    @UsuarioActual() usuario: UsuarioJwt,
  ): Promise<LoteCalidad> {
    return this.laboratorio.evaluar(codigoLote, dto, usuario.username);
  }
}
