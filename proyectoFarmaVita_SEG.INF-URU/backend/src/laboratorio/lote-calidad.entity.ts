import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';

export enum EstadoLote {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Entity({ name: 'lotes_calidad' })
export class LoteCalidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  codigoLote: string;

  @Index()
  @Column({ type: 'int' })
  medicamentoId: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  temperaturaRegistro: number | null;

  @Column({ type: 'enum', enum: EstadoLote, default: EstadoLote.PENDIENTE })
  estado: EstadoLote;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  analistaLdap: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaEvaluacion: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaRegistro: Date;
}
