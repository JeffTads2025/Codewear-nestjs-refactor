import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderAuthGuard } from '../auth/order-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/order-auth.guard.js';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto.js';
import { ServiceOrdersService } from '../service-orders.service.js';

@Controller('cart')
@UseGuards(OrderAuthGuard)
export class CartController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.serviceOrdersService.listCart(request.userId);
  }

  @Post()
  add(
    @Body() input: AddCartItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrdersService.addCartItem(input, request.userId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateCartItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrdersService.updateCartItem(
      id,
      input.quantity,
      request.userId,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrdersService.removeCartItem(id, request.userId);
  }
}
