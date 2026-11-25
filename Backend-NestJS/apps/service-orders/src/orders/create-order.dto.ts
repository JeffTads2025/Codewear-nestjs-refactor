import { IsNumber, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNumber()
  @Min(0)
  totalValue!: number;

  @IsString()
  paymentMethod!: string;

  @IsString()
  address!: string;
}
