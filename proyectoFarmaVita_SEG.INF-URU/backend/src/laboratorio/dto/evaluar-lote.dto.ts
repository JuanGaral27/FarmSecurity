import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoLote } from '../lote-calidad.entity';

export class EvaluarLoteDto {
  @IsIn([EstadoLote.APROBADO, EstadoLote.RECHAZADO], {
    message: 'estado debe ser APROBADO o RECHAZADO',
  })
  estado: EstadoLote.APROBADO | EstadoLote.RECHAZADO;

  /** Temperatura medida (°C) durante la evaluación / recepción */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-80)
  @Max(80)
  temperaturaRegistro: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
