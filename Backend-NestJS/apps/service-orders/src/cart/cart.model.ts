import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Product } from '../orders/product.model.js';

@Table({ tableName: 'carts', timestamps: true })
export class Cart extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  declare quantity: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @ForeignKey(() => Product)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare productId: number;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare size: string | null;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'Product' })
  declare Product: Product;
}
