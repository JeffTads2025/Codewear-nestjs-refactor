import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { AdminOrderGuard } from '../auth/admin-order.guard.js';
import { Order } from './order.model.js';
import { OrderItem } from './order-item.model.js';
import { CatalogInternalClient } from '../catalog-internal.client.js';

interface DashboardMetrics {
  totalRevenue: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalOrders: number;
  totalUsers: number;
}

interface MetricsRow {
  totalRevenue: string | number;
  dailyRevenue: string | number;
  monthlyRevenue: string | number;
  yearlyRevenue: string | number;
  totalOrders: number;
}

@Controller('admin')
@UseGuards(AdminOrderGuard)
export class AdminOrdersController {
  constructor(
    @InjectConnection() private readonly database: Sequelize,
    @InjectModel(Order) private readonly orders: typeof Order,
    private readonly catalog: CatalogInternalClient,
  ) {}

  @Get(['dashboard', 'metrics', 'revenue'])
  async getMetrics(
    @Query('day') day?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ): Promise<DashboardMetrics> {
    const now = new Date();
    const effectiveYear = this.validNumber(year, now.getFullYear(), 9999);
    const effectiveMonth = this.validNumber(month, now.getMonth() + 1, 12);
    const effectiveDay = this.validNumber(day, now.getDate(), 31);

    try {
      const [row] = await this.database.query<MetricsRow>(
        `SELECT
           COALESCE(SUM(totalValue), 0) AS totalRevenue,
           COALESCE(SUM(CASE WHEN DATE(createdAt) = ? THEN totalValue ELSE 0 END), 0) AS dailyRevenue,
           COALESCE(SUM(CASE WHEN YEAR(createdAt) = ? AND MONTH(createdAt) = ? THEN totalValue ELSE 0 END), 0) AS monthlyRevenue,
           COALESCE(SUM(CASE WHEN YEAR(createdAt) = ? THEN totalValue ELSE 0 END), 0) AS yearlyRevenue,
           COUNT(*) AS totalOrders
         FROM orders`,
        {
          replacements: [
            `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`,
            effectiveYear,
            effectiveMonth,
            effectiveYear,
          ],
          type: QueryTypes.SELECT,
        },
      );
      const totalUsers = await this.catalog.countActiveCustomers();

      return {
        totalRevenue: Number(row.totalRevenue),
        dailyRevenue: Number(row.dailyRevenue),
        monthlyRevenue: Number(row.monthlyRevenue),
        yearlyRevenue: Number(row.yearlyRevenue),
        totalOrders: Number(row.totalOrders),
        totalUsers,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível calcular métricas de vendas',
        { cause: error },
      );
    }
  }

  @Get('all-orders')
  async listAllOrders(
    @Query('page') pageInput?: string,
    @Query('limit') limitInput?: string,
  ) {
    const page = this.validNumber(pageInput, 1, 100000);
    const limit = this.validNumber(limitInput, 50, 100);
    try {
      const { count, rows } = await this.orders.findAndCountAll({
        include: [
          { model: OrderItem, as: 'OrderItems' },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
      });
      const total = count;

      return {
        orders: await Promise.all(rows.map(async (order) => {
          const user = await this.catalog.getUserSummary(order.userId);
          return {
            ...order.get({ plain: true }),
            User: { id: user.id, name: user.name },
            OrderItems: (order.OrderItems ?? []).map((item) => ({
              ...item.get({ plain: true }),
              Product: {
                id: item.productId,
                name: item.productName ?? `Produto #${item.productId}`,
                image_url: item.productImageUrl,
              },
            })),
          };
        })),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível carregar vendas',
        { cause: error },
      );
    }
  }

  private validNumber(value: string | undefined, fallback: number, max: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= max
      ? number
      : fallback;
  }
}
