import {
  AutoIncrement,
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'product_sizes', timestamps: true })
export class ProductSize extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare productId: number;

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare size: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare stock: number;
}
