import { IsInt, Min } from 'class-validator';

export class UpdateProductStockDto {
  @IsInt()
  @Min(0)
  stock!: number;
}
