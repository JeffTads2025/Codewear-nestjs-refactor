import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderAuthGuard } from './auth/order-auth.guard.js';
import type { AuthenticatedRequest } from './auth/order-auth.guard.js';
import { CreateOrderDto } from './orders/create-order.dto.js';
import { ServiceOrdersService } from './service-orders.service.js';

@Controller('orders')
@UseGuards(OrderAuthGuard)
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  create(
    @Body() order: CreateOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrdersService.create(order, request.userId);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceOrdersService.listOrders(
      request.userId,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }
}
