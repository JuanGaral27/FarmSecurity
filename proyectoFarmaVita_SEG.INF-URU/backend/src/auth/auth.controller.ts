import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService, RespuestaLogin } from './auth.service';
import { UsuarioActual } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioJwt } from './roles.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/login -> bind LDAP + emisión de JWT { sub, username, role } */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<RespuestaLogin> {
    return this.auth.login(dto.username, dto.password);
  }

  /** GET /auth/perfil -> datos del token vigente */
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil(@UsuarioActual() usuario: UsuarioJwt): UsuarioJwt {
    return usuario;
  }
}
