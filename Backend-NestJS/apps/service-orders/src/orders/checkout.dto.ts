import { IsString, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @MinLength(1)
  paymentMethod!: string;

  @IsString()
  @MinLength(1)
  address!: string;
}
