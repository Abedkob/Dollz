import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAllowedOrigin } from '../auth/security.js';
import type { ReturnTypeOfGuards } from '../catalog/types.js';
import type { OrderService } from './service.js';
import {
  adminMessageSchema,
  adminOrderListSchema,
  approveSchema,
  cancelSchema,
  exchangeSchema,
  guestMessageSchema,
  orderIdParams,
  orderNumberParams,
  orderSubmissionSchema,
  parseOrderInput,
  paymentRequestSchema,
  paymentVerifySchema,
  rejectSchema,
  requestChangesSchema,
  revisionParams,
  revisionResponseSchema,
  shippingSchema,
  statusSchema,
  versionSchema,
} from './schemas.js';
import { OrderError } from './errors.js';

const guestCookie = 'dollz_order_guest';
const admin = (request: FastifyRequest) => request.adminPrincipal!.id;
const csrfHeader = (request: FastifyRequest) => {
  const value = request.headers['x-csrf-token'];
  return Array.isArray(value) ? value[0] : value;
};

const MAX_RATE_LIMITER_ENTRIES = 50_000;

class RequestRateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();
  constructor(
    private readonly maximum: number,
    private readonly windowMilliseconds: number,
  ) {}
  allow(key: string) {
    const now = Date.now();
    const current = this.windows.get(key);
    const window =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + this.windowMilliseconds }
        : current;
    window.count += 1;
    this.windows.delete(key);
    this.windows.set(key, window);
    while (this.windows.size > MAX_RATE_LIMITER_ENTRIES) {
      const oldestKey = this.windows.keys().next().value;
      if (oldestKey === undefined) break;
      this.windows.delete(oldestKey);
    }
    return window.count <= this.maximum;
  }
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  service: OrderService,
  guards: ReturnTypeOfGuards,
  config: {
    allowedOrigins: readonly string[];
    secureCookies: boolean;
    publicBaseUrl: string;
  },
) {
  const submissionLimiter = new RequestRateLimiter(12, 15 * 60_000);
  const guestLimiter = new RequestRateLimiter(60, 5 * 60_000);
  const exchangeLimiter = new RequestRateLimiter(30, 5 * 60_000);
  const adminRead = { preHandler: [guards.authenticate] };
  const adminWrite = { preHandler: [guards.authenticate, guards.csrf] };

  const guestOrder = async (request: FastifyRequest, mutation = false) => {
    if (!guestLimiter.allow(request.ip))
      throw new OrderError('RATE_LIMITED', 429);
    if (mutation)
      verifyAllowedOrigin(
        request.headers.origin,
        request.headers.referer,
        config.allowedOrigins,
      );
    const { orderNumber } = parseOrderInput(orderNumberParams, request.params);
    return service.authorizeGuest(
      request.cookies[guestCookie],
      orderNumber,
      mutation ? csrfHeader(request) : undefined,
      mutation,
    );
  };

  app.post('/orders', { bodyLimit: 256_000 }, async (request, reply) => {
    if (!submissionLimiter.allow(request.ip))
      throw new OrderError('RATE_LIMITED', 429);
    const input = parseOrderInput(orderSubmissionSchema, request.body);
    const result = await service.submit(input, request.ip);
    return reply.code(result.idempotent ? 200 : 201).send(result);
  });

  app.post('/orders/access/exchange', async (request, reply) => {
    if (!exchangeLimiter.allow(request.ip))
      throw new OrderError('RATE_LIMITED', 429);
    const input = parseOrderInput(exchangeSchema, request.body);
    const result = await service.exchange(input.orderNumber, input.token);
    reply.setCookie(guestCookie, result.session, {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'strict',
      path: '/orders',
      maxAge: 30 * 60,
    });
    return {
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
      order: result.order,
    };
  });

  app.get('/orders/:orderNumber', async (request) =>
    service.guestOrder(await guestOrder(request)),
  );
  app.get('/orders/:orderNumber/history', async (request) => {
    const order = await service.guestOrder(await guestOrder(request));
    return { items: order.history };
  });
  app.get('/orders/:orderNumber/messages', async (request) => {
    const order = await service.guestOrder(await guestOrder(request));
    return { items: order.messages };
  });
  app.post('/orders/:orderNumber/messages', async (request) => {
    const orderId = await guestOrder(request, true);
    return service.guestMessage(
      orderId,
      parseOrderInput(guestMessageSchema, request.body).message,
    );
  });
  app.post(
    '/orders/:orderNumber/revisions/:revisionId/respond',
    async (request) => {
      const orderId = await guestOrder(request, true);
      const params = parseOrderInput(revisionParams, request.params);
      const input = parseOrderInput(revisionResponseSchema, request.body);
      return service.respondToRevision(
        orderId,
        params.revisionId,
        input.response,
        input.message ?? null,
        input.replacements,
      );
    },
  );
  app.post('/orders/:orderNumber/access/revoke', async (request, reply) => {
    const orderId = await guestOrder(request, true);
    await service.revokeOwnAccess(orderId);
    reply.clearCookie(guestCookie, {
      path: '/orders',
    });
    return reply.code(204).send();
  });

  app.get('/admin/orders', adminRead, async (request) =>
    service.list(parseOrderInput(adminOrderListSchema, request.query)),
  );
  app.get('/admin/orders/:orderId', adminRead, async (request) =>
    service.adminDetail(parseOrderInput(orderIdParams, request.params).orderId),
  );
  app.post(
    '/admin/orders/:orderId/start-review',
    adminWrite,
    async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      const { expectedVersion } = parseOrderInput(versionSchema, request.body);
      return service.startReview(orderId, expectedVersion, admin(request));
    },
  );
  app.post(
    '/admin/orders/:orderId/request-changes',
    adminWrite,
    async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      return service.requestChanges(
        orderId,
        parseOrderInput(requestChangesSchema, request.body),
        admin(request),
      );
    },
  );
  app.post('/admin/orders/:orderId/approve', adminWrite, async (request) => {
    const { orderId } = parseOrderInput(orderIdParams, request.params);
    return service.approve(
      orderId,
      parseOrderInput(approveSchema, request.body),
      admin(request),
    );
  });
  app.post('/admin/orders/:orderId/reject', adminWrite, async (request) => {
    const { orderId } = parseOrderInput(orderIdParams, request.params);
    return service.reject(
      orderId,
      parseOrderInput(rejectSchema, request.body),
      admin(request),
    );
  });
  app.post('/admin/orders/:orderId/cancel', adminWrite, async (request) => {
    const { orderId } = parseOrderInput(orderIdParams, request.params);
    return service.cancel(
      orderId,
      parseOrderInput(cancelSchema, request.body),
      admin(request),
    );
  });
  for (const [path, internal] of [
    ['messages', false],
    ['internal-notes', true],
  ] as const) {
    app.post(`/admin/orders/:orderId/${path}`, adminWrite, async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      const input = parseOrderInput(adminMessageSchema, request.body);
      return service.adminMessage(
        orderId,
        input.expectedVersion,
        input.message,
        internal,
        admin(request),
      );
    });
  }
  app.post(
    '/admin/orders/:orderId/payments/request',
    adminWrite,
    async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      return service.requestPayment(
        orderId,
        parseOrderInput(paymentRequestSchema, request.body),
        admin(request),
      );
    },
  );
  app.post(
    '/admin/orders/:orderId/payments/verify',
    adminWrite,
    async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      return service.verifyPayment(
        orderId,
        parseOrderInput(paymentVerifySchema, request.body),
        admin(request),
      );
    },
  );
  app.post('/admin/orders/:orderId/status', adminWrite, async (request) => {
    const { orderId } = parseOrderInput(orderIdParams, request.params);
    return service.productionStatus(
      orderId,
      parseOrderInput(statusSchema, request.body),
      admin(request),
    );
  });
  app.post('/admin/orders/:orderId/shipping', adminWrite, async (request) => {
    const { orderId } = parseOrderInput(orderIdParams, request.params);
    return service.updateShipping(
      orderId,
      parseOrderInput(shippingSchema, request.body),
      admin(request),
    );
  });
  app.post(
    '/admin/orders/:orderId/access/regenerate',
    adminWrite,
    async (request) => {
      const { orderId } = parseOrderInput(orderIdParams, request.params);
      const { expectedVersion } = parseOrderInput(versionSchema, request.body);
      return service.regenerateAccess(
        orderId,
        expectedVersion,
        admin(request),
        config.publicBaseUrl,
      );
    },
  );
}
