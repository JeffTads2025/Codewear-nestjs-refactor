import { Test, TestingModule } from '@nestjs/testing';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { OrderAuthGuard } from './auth/order-auth.guard.js';
import type { AuthenticatedRequest } from './auth/order-auth.guard.js';

describe('ServiceOrdersController', () => {
  let serviceOrdersController: ServiceOrdersController;
  const service = { create: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const builder = Test.createTestingModule({
      controllers: [ServiceOrdersController],
      providers: [
        { provide: ServiceOrdersService, useValue: service },
      ],
    });
    builder.overrideGuard(OrderAuthGuard).useValue({ canActivate: () => true });
    const app: TestingModule = await builder.compile();

    serviceOrdersController = app.get<ServiceOrdersController>(ServiceOrdersController);
  });

  describe('create', () => {
    it('passes the authenticated user id and order DTO to the service', () => {
      const input = { totalValue: 25, paymentMethod: 'pix', address: 'Rua 1' };
      const request = { userId: 7 } as AuthenticatedRequest;

      serviceOrdersController.create(input, request);

      expect(service.create).toHaveBeenCalledWith(input, 7);
    });
  });
});
