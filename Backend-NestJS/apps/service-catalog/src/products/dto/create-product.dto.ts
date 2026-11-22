import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductSizeInputDto {
  @IsString()
  size!: string;

  @IsInt()
  @Min(0)
  stock!: number;
}

export class ProductPromotionInputDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage!: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsBoolean()
  isActive!: boolean;
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeInputDto)
  sizes?: ProductSizeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPromotionInputDto)
  promotions?: ProductPromotionInputDto[];
}
