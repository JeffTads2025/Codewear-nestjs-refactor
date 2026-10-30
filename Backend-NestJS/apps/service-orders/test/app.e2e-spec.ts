import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ServiceOrdersController } from './../src/service-orders.controller.js';
import { ServiceOrdersService } from './../src/service-orders.service.js';
import { OrderAuthGuard } from './../src/auth/order-auth.guard.js';

describe('POST /orders (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: vi.fn().mockResolvedValue({
      message: 'Pedido criado com sucesso',
      order: { id: 12 },
    }),
  };

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [ServiceOrdersController],
      providers: [{ provide: ServiceOrdersService, useValue: service }],
    });
    builder.overrideGuard(OrderAuthGuard).useValue({
      canActivate: (context: { switchToHttp: () => { getRequest: () => object } }) => {
        Object.assign(context.switchToHttp().getRequest(), { userId: 5 });
        return true;
      },
    });
    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('creates an order and responds with its id', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ totalValue: 30, paymentMethod: 'pix', address: 'Rua 1' })
      .expect(201)
      .expect({ message: 'Pedido criado com sucesso', order: { id: 12 } });

    expect(service.create).toHaveBeenCalledWith(
      { totalValue: 30, paymentMethod: 'pix', address: 'Rua 1' },
      5,
    );
  });

  it('rejects invalid order DTOs before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ totalValue: -1, paymentMethod: 'pix', address: 'Rua 1' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
        });
        expect(body.message).toBeInstanceOf(Array);
      });

    expect(service.create).not.toHaveBeenCalled();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });
});
