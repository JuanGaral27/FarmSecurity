import { IsBoolean, IsInt, IsNumber, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CrearMedicamentoDto {
  @IsString()
  @Length(2, 150)
  nombre: string;

  @IsString()
  @Length(2, 150)
  principioActivo: string;

  @IsString()
  @Matches(/^[A-Z0-9-]{3,60}$/, { message: 'loteActual: use MAYÚSCULAS, dígitos y guiones (3-60)' })
  loteActual: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precio: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-80)
  @Max(40)
  temperaturaRequerida: number;

  @IsBoolean()
  requiereCadenaFrio: boolean;
}
