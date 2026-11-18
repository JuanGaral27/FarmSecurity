import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  // Lista blanca de caracteres: impide inyección LDAP en el DN
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{1,64}$/, { message: 'Usuario con formato inválido' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(128)
  password: string;
}
