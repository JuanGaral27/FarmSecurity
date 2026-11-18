import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class IngresoStockDto {
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cantidad: number;

  /** Si llega un lote distinto al actual, se registra en cuarentena (PENDIENTE). */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{3,60}$/, { message: 'lote: use MAYÚSCULAS, dígitos y guiones (3-60)' })
  lote?: string;
}
