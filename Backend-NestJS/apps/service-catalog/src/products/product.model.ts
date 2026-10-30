import {
  AutoIncrement,
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ProductSize } from './product-size.model.js';
import { Promotion } from './promotion.model.js';

@Table({ tableName: 'products', timestamps: true })
export class Product extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare price: number;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Column(DataType.STRING)
  declare category: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare stock: number;

  @Column(DataType.STRING)
  declare image_url: string | null;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isVisible: boolean;

  @HasMany(() => ProductSize, { foreignKey: 'productId', as: 'sizes' })
  declare sizes: ProductSize[];

  @HasMany(() => Promotion, { foreignKey: 'productId', as: 'promotions' })
  declare promotions: Promotion[];
}
