import {
  AutoIncrement,
  Column,
  DataType,
  Default,
  BelongsTo,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { OrderItem } from './order-item.model.js';
import { User } from './user.model.js';

@Table({ tableName: 'orders', timestamps: true })
export class Order extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare totalValue: number;

  @Default('pendente')
  @Column({ type: DataType.STRING, allowNull: false })
  declare status: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare paymentMethod: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare address: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @HasMany(() => OrderItem, { foreignKey: 'orderId', as: 'OrderItems' })
  declare OrderItems: OrderItem[];

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'User' })
  declare User: User;
}
