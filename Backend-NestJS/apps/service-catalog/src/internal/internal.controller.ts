import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import { InternalInventoryDto } from './internal-inventory.dto.js';
import { InternalService } from './internal.service.js';

@Controller('internal')
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  @Get('users/count')
  countActiveCustomers() {
    return this.internal.countActiveCustomers();
  }

  @Get('users/:id/summary')
  getUserSummary(@Param('id', ParseIntPipe) id: number) {
    return this.internal.getUserSummary(id);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.internal.getUser(id);
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.internal.getProduct(id);
  }

  @Post('inventory/reserve')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  reserve(@Body() input: InternalInventoryDto) {
    return this.internal.reserve(input);
  }

  @Post('inventory/release')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async release(@Body() input: InternalInventoryDto) {
    await this.internal.release(input);
    return { message: 'Estoque estornado com sucesso' };
  }
}
