import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';

@Entity({ name: 'ventas' })
export class Venta {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  medicamentoId: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  total: number;

  @Column({ type: 'varchar', length: 64 })
  vendedorLdap: string;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaVenta: Date;
}
