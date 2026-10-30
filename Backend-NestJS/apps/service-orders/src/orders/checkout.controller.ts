import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { OrderAuthGuard } from '../auth/order-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/order-auth.guard.js';
import { CheckoutDto } from './checkout.dto.js';
import { ServiceOrdersService } from '../service-orders.service.js';

@Controller('checkout')
@UseGuards(OrderAuthGuard)
export class CheckoutController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  checkout(
    @Body() input: CheckoutDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrdersService.checkout(input, request.userId);
  }
}
