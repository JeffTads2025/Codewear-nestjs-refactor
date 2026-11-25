import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface CatalogProduct {
  id: number;
  name: string;
  price: number;
  currentPrice: number;
  image_url: string | null;
  stock: number;
  sizes: Array<{ id: number; size: string; stock: number }>;
  promotions: Array<{
    discountPercentage: number;
    validFrom: string | null;
    validUntil: string | null;
    isActive: boolean;
    productId: number | null;
  }>;
}

export interface InventoryReservation {
  productId: number;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  size: string | null;
  unitPrice: number;
}

export interface CatalogUser {
  id: number;
  name: string;
  address: string | null;
}

@Injectable()
export class CatalogInternalClient {
  private readonly baseUrl =
    process.env.CATALOG_INTERNAL_URL ??
    'http://service-catalog:3000/internal';

  async getProduct(productId: number): Promise<CatalogProduct> {
    return this.request<CatalogProduct>(`/products/${productId}`);
  }

  async getUser(userId: number): Promise<CatalogUser> {
    return this.request<CatalogUser>(`/users/${userId}`);
  }

  async getUserSummary(userId: number): Promise<CatalogUser> {
    return this.request<CatalogUser>(`/users/${userId}/summary`);
  }

  async countActiveCustomers(): Promise<number> {
    const result = await this.request<{ count: number }>('/users/count');
    return result.count;
  }

  async reserve(input: {
    productId: number;
    quantity: number;
    size: string | null;
  }): Promise<InventoryReservation> {
    return this.request<InventoryReservation>('/inventory/reserve', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async release(input: {
    productId: number;
    quantity: number;
    size: string | null;
  }): Promise<void> {
    await this.request('/inventory/release', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const secret = process.env.INTERNAL_API_KEY;
    if (!secret) {
      throw new ServiceUnavailableException(
        'INTERNAL_API_KEY não está configurada',
      );
    }

    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Internal-Secret', secret);
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Não foi possível acessar o catálogo interno: ${String(error)}`,
      );
    }

    if (!response.ok) {
      if (response.status === 400) {
        throw new BadRequestException('Requisição rejeitada pelo catálogo');
      }
      if (response.status === 403) {
        throw new ForbiddenException('Usuário inativo');
      }
      if (response.status === 404) {
        throw new NotFoundException('Usuário ou produto não encontrado');
      }
      throw new BadGatewayException(
        `Catálogo interno respondeu com HTTP ${response.status}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
