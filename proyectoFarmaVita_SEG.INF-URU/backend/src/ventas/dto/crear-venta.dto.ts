import { IsInt, Max, Min } from 'class-validator';

export class CrearVentaDto {
  @IsInt()
  @Min(1)
  medicamentoId: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  cantidad: number;
}
