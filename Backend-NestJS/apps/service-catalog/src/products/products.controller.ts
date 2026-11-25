import {
  Body,
  Controller,
  Delete,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Put,
  Query,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { UpdateProductStockDto } from './dto/update-product-stock.dto.js';
import { JwtAuthGuard, type AuthenticatedUserRequest } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  RolesGuard,
} from '../auth/roles.guard.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.list(page, limit);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() product: CreateProductDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.productsService.create(product, request.user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() product: UpdateProductDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.productsService.update(id, product, request.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() product: UpdateProductDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.productsService.update(id, product, request.user);
  }

  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateProductStockDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.productsService.updateStock(id, input, request.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.productsService.delete(id, request.user);
  }
}
