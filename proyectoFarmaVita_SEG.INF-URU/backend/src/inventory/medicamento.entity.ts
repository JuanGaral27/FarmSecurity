import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';

@Entity({ name: 'medicamentos' })
export class Medicamento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 150 })
  principioActivo: string;

  @Column({ type: 'varchar', length: 60 })
  loteActual: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  precio: number;

  /** Temperatura máxima de conservación en °C (cadena de frío: 2 °C – este valor). */
  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numericTransformer })
  temperaturaRequerida: number;

  @Column({ type: 'boolean', default: false })
  requiereCadenaFrio: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
