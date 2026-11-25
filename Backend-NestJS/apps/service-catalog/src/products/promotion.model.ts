import {
  AutoIncrement,
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'promotions', timestamps: true })
export class Promotion extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.STRING(50), allowNull: true, unique: true })
  declare code: string | null;

  @Column({ type: DataType.DECIMAL(5, 2), allowNull: false })
  declare discountPercentage: number;

  @Column(DataType.DATE)
  declare validFrom: Date | null;

  @Column(DataType.DATE)
  declare validUntil: Date | null;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isActive: boolean;

  @Column(DataType.INTEGER)
  declare productId: number | null;
}
