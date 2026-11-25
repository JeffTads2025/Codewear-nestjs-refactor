import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

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

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare orderId: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare productId: number;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare size: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare productName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare productImageUrl: string | null;
}
