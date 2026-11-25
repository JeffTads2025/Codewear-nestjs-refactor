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
import { Order } from './order.model.js';
import { Product } from './product.model.js';

@Table({ tableName: 'order_items', timestamps: true })
export class OrderItem extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare quantity: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare priceAtPurchase: number;

  @ForeignKey(() => Order)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare orderId: number;

  @ForeignKey(() => Product)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare productId: number;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare size: string | null;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'Product' })
  declare Product: Product;
}
