import request from 'supertest';

const BASE = 'http://localhost:3000/api';
const runId = Date.now();

const state = {
  token: '',
  adminToken: '',
  refreshToken: '',
  productId: 0,
  productSlug: '',
  existingSlug: '',
  defaultVariantId: 0,
  variantId: 0,
  categoryId: 0,
  highlightId: 0,
  userId: '',
  adminUserId: '',
  reviewId: 0,
  cartItemId: '',
  cartId: '',
  provinceId: '',
  cityId: '',
  districtId: '',
  addressId: 0,
  orderCartId: '',
  orderId: '',
};

const authHeader = () => ({ Authorization: `Bearer ${state.token}` });

describe('Smoke Tests (e2e)', () => {
  describe('Auth', () => {
    it('POST /auth/login — admin login', async () => {
      const res = await request(BASE)
        .post('/auth/login')
        .send({ email: 'admin@mamabear.id', password: 'admin' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      state.token = res.body.data.accessToken;
      state.refreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/logout', async () => {
      const res = await request(BASE)
        .post('/auth/logout')
        .set(authHeader())
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('POST /auth/login — re-login after logout', async () => {
      const res = await request(BASE)
        .post('/auth/login')
        .send({ email: 'admin@mamabear.id', password: 'admin' })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.token = res.body.data.accessToken;
      state.refreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/refresh — should return new tokens', async () => {
      const res = await request(BASE)
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${state.refreshToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('POST /auth/login — ADMIN-role login', async () => {
      const res = await request(BASE)
        .post('/auth/login')
        .send({ email: 'admin2@mamabear.id', password: 'admin' })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.adminToken = res.body.data.accessToken;
    });
  });

  describe('Root & Health', () => {
    it('GET /', async () => {
      await request('http://localhost:3000').get('/api').expect(200);
    });

    it('GET /health', async () => {
      const res = await request('http://localhost:3000')
        .get('/api/health')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  const hasShippingApi =
    process.env.RAJAONGKIR_API_KEY && process.env.RAJAONGKIR_BASE_URL;

  (hasShippingApi ? describe : describe.skip)('Shipping', () => {
    it('GET /shipping/province', async () => {
      const res = await request(BASE)
        .get('/shipping/province')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      state.provinceId = res.body.data[0].id;
    });

    it('GET /shipping/city/:provinceId', async () => {
      const res = await request(BASE)
        .get(`/shipping/city/${state.provinceId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      state.cityId = res.body.data[0].id;
    });

    it('GET /shipping/district/:cityId', async () => {
      const res = await request(BASE)
        .get(`/shipping/district/${state.cityId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      state.districtId = res.body.data[0].id;
    });

    it('GET /shipping/subdistrict/:districtId', async () => {
      const res = await request(BASE)
        .get(`/shipping/subdistrict/${state.districtId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Products (Public)', () => {
    it('GET /products', async () => {
      const res = await request(BASE).get('/products').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      state.existingSlug = res.body.data.data[0].slug;
    });

    it('GET /products/search?q=mamabear', async () => {
      const res = await request(BASE)
        .get('/products/search?q=mamabear')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
    });

    it('GET /products/filter', async () => {
      const res = await request(BASE)
        .get('/products/filter?categories[]=maternity-supplies')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /products/search/suggestions?q=ma', async () => {
      const res = await request(BASE)
        .get('/products/search/suggestions?q=ma')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /products/:slug', async () => {
      const res = await request(BASE)
        .get(`/products/${state.existingSlug}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(state.existingSlug);
    });

    it('GET /products/:slug/related', async () => {
      const res = await request(BASE)
        .get(`/products/${state.existingSlug}/related`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /products/:slug/variants', async () => {
      const res = await request(BASE)
        .get(`/products/${state.existingSlug}/variants`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /products/:slug/reviews', async () => {
      const res = await request(BASE)
        .get(`/products/${state.existingSlug}/reviews`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /products/:slug/reviews/summary', async () => {
      const res = await request(BASE)
        .get(`/products/${state.existingSlug}/reviews/summary`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Categories (Public)', () => {
    it('GET /categories', async () => {
      const res = await request(BASE).get('/categories').expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /categories/:slug', async () => {
      const res = await request(BASE)
        .get('/categories/maternity-supplies')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Highlights (Public)', () => {
    it('GET /highlights', async () => {
      const res = await request(BASE).get('/highlights').expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /highlights/:id', async () => {
      const res = await request(BASE).get('/highlights/1').expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Admin — Create', () => {
    it('POST /admin/products', async () => {
      const res = await request(BASE)
        .post('/admin/products')
        .set(authHeader())
        .send({
          name: `Smoke Product ${runId}`,
          description: 'Smoke test product',
          ingredients: 'Test ingredients',
          usageInstructions: 'Test usage',
          weightG: 100,
          priceIdr: 50000,
          stock: 10,
          sku: `SMOKE-${runId}`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.productId = res.body.data.id;
      state.productSlug = res.body.data.slug;
      const defaultVariant = res.body.data.variants.find(
        (v: any) => v.sortOrder === 0,
      );
      state.defaultVariantId = defaultVariant.id;
    });

    it('POST /admin/products/:id/variants', async () => {
      const res = await request(BASE)
        .post(`/admin/products/${state.productId}/variants`)
        .set(authHeader())
        .send({
          name: `Smoke Variant ${runId}`,
          priceIdr: 50000,
          weightG: 100,
          sku: `SMOKE-VAR-${runId}`,
          stock: 10,
          sortOrder: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.variantId = res.body.data.id;
    });

    it('POST /admin/categories', async () => {
      const res = await request(BASE)
        .post('/admin/categories')
        .set(authHeader())
        .send({
          name: `Smoke Category ${runId}`,
          description: 'Smoke test category',
          sortOrder: 99,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.categoryId = res.body.data.id;
    });

    it('POST /admin/highlights', async () => {
      const res = await request(BASE)
        .post('/admin/highlights')
        .set(authHeader())
        .send({
          name: `Smoke Highlight ${runId}`,
          description: 'Smoke test highlight',
          slug: `smoke-highlight-${runId}`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.highlightId = res.body.data.id;
    });

    it('POST /admin/users', async () => {
      const res = await request(BASE)
        .post('/admin/users')
        .set(authHeader())
        .send({
          email: `smoke-user-${runId}@test.com`,
          password: 'password123',
          name: `Smoke User ${runId}`,
          phone: '081234567891',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.userId = res.body.data.id;
    });

    it('POST /products/:slug/reviews — create review', async () => {
      const res = await request(BASE)
        .post(`/products/${state.productSlug}/reviews`)
        .set(authHeader())
        .send({
          title: 'Smoke review',
          reviewerId: state.userId,
          description: 'Great product from smoke test',
          rating: 5,
          imageUrls: [],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.reviewId = res.body.data.id;
    });

    it('POST /admin/products/:id/variants/:variantId/discount', async () => {
      const res = await request(BASE)
        .post(
          `/admin/products/${state.productId}/variants/${state.defaultVariantId}/discount`,
        )
        .set(authHeader())
        .send({
          isPercent: false,
          amount: 5000,
          startedAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2026-12-31T23:59:59.000Z',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Admin — Read created data', () => {
    it('GET /admin/products/:id', async () => {
      const res = await request(BASE)
        .get(`/admin/products/${state.productId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(state.productId);
    });

    it('GET /admin/products/:id/variants', async () => {
      const res = await request(BASE)
        .get(`/admin/products/${state.productId}/variants`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /admin/products/:id/reviews', async () => {
      const res = await request(BASE)
        .get(`/admin/products/${state.productId}/reviews`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /admin/users/:id', async () => {
      const res = await request(BASE)
        .get(`/admin/users/${state.userId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /admin/upload/signature', async () => {
      const res = await request(BASE)
        .get('/admin/upload/signature')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /admin/upload/images', async () => {
      const res = await request(BASE)
        .get('/admin/upload/images')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /admin/activity-logs — list activity logs', async () => {
      const res = await request(BASE)
        .get('/admin/activity-logs?limit=5&page=1&sortBy=createdAt&sortOrder=desc')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });
  });

  describe('Cart', () => {
    it('POST /cart/items — add to cart', async () => {
      const res = await request(BASE)
        .post('/cart/items')
        .set(authHeader())
        .send({
          productId: state.productId,
          variantId: state.defaultVariantId,
          quantity: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.cartItemId = res.body.data.id;
    });

    it('GET /cart', async () => {
      const res = await request(BASE)
        .get('/cart')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      state.cartId = res.body.data.id;
    });

    it('GET /cart/totals', async () => {
      const res = await request(BASE)
        .get('/cart/totals')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /cart/validate', async () => {
      const res = await request(BASE)
        .post('/cart/validate')
        .set(authHeader())
        .expect(201);

      expect(res.body.data.valid).toBe(true);
    });

    it('PATCH /cart/:id/courier', async () => {
      const res = await request(BASE)
        .patch(`/cart/${state.cartId}/courier`)
        .set(authHeader())
        .send({
          shippingCostIdr: 15000,
          courierName: 'JNE',
          courierCode: 'jne',
          shippingMethod: 'REG',
        })
        .expect(200);

      expect(res.body.data.courierName).toBe('JNE');
      expect(res.body.data.shippingCostIdr).toBe(15000);
    });

    it('DELETE /cart/:id/courier', async () => {
      const res = await request(BASE)
        .delete(`/cart/${state.cartId}/courier`)
        .set(authHeader())
        .expect(200);

      expect(res.body.data.courierName).toBeNull();
      expect(res.body.data.shippingCostIdr).toBe(0);
    });

    it('PATCH /cart/items/:id', async () => {
      const res = await request(BASE)
        .patch(`/cart/items/${state.cartItemId}`)
        .set(authHeader())
        .send({ quantity: 3 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /cart/items/:id', async () => {
      const res = await request(BASE)
        .delete(`/cart/items/${state.cartItemId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /cart/merge', async () => {
      const res = await request(BASE)
        .post('/cart/merge')
        .set(authHeader())
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /cart — clear cart', async () => {
      const res = await request(BASE)
        .delete('/cart')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Orders', () => {
    it('POST /me/addresses — create address', async () => {
      const res = await request(BASE)
        .post('/me/addresses')
        .set(authHeader())
        .send({
          name: 'Kevin ADMIN',
          phone: '0856123456',
          provinceId: 1,
          provinceName: 'NUSA TENGGARA BARAT (NTB)',
          cityId: 1,
          cityName: 'MATARAM',
          districtId: 3,
          districtName: 'CAKRANEGARA',
          subdistrictId: 20,
          subdistrictName: 'CAKRANEGARA BARAT',
          postalCode: '83239',
          road: 'Jl. Abu Dhabi Sejahtera Selamanya',
          detail: 'Sebelah Indomaret besar (bukan indomaret kecil)',
          usedFor: 'RUMAH2',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.addressId = res.body.data.id;
    });

    it('POST /cart/items — add item for order', async () => {
      const res = await request(BASE)
        .post('/cart/items')
        .set(authHeader())
        .send({
          productId: state.productId,
          variantId: state.defaultVariantId,
          quantity: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('GET /cart — capture cartId for order', async () => {
      const res = await request(BASE)
        .get('/cart')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      state.orderCartId = res.body.data.id;
    });

    it('POST /order — create order', async () => {
      const res = await request(BASE)
        .post('/order')
        .set(authHeader())
        .send({
          cartId: state.orderCartId,
          addressId: state.addressId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      state.orderId = res.body.data.id;
    });

    it('GET /order — list orders', async () => {
      const res = await request(BASE)
        .get('/order?limit=5')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
    });

    it('GET /order/:id — order detail', async () => {
      const res = await request(BASE)
        .get(`/order/${state.orderId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(state.orderId);
    });

    it('POST /order/:id/cancel — cancel order (admin token bypasses status check)', async () => {
      const res = await request(BASE)
        .post(`/order/${state.orderId}/cancel`)
        .set(authHeader())
        .send({ reason: 'Smoke test cancel' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('POST /admin/order/:id/cancel — admin cancel already-cancelled order', async () => {
      const res = await request(BASE)
        .post(`/admin/order/${state.orderId}/cancel`)
        .set(authHeader())
        .send({ reason: 'Smoke test admin cancel' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Admin — User Management', () => {
    it('GET /admin/users — list admin users', async () => {
      const res = await request(BASE)
        .get('/admin/users')
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      expect(res.body.data.pagination).toBeDefined();
      state.adminUserId = res.body.data.data.find(
        (u: any) => u.role === 'ADMIN',
      )?.id ?? '';
    });

    it('PUT /admin/users/:id/status — deactivate admin user', async () => {
      if (!state.adminUserId) return;
      const res = await request(BASE)
        .put(`/admin/users/${state.adminUserId}/status`)
        .set(authHeader())
        .send({ isBlocked: true })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBlocked).toBe(true);
    });

    it('PUT /admin/users/:id/status — reactivate admin user', async () => {
      if (!state.adminUserId) return;
      const res = await request(BASE)
        .put(`/admin/users/${state.adminUserId}/status`)
        .set(authHeader())
        .send({ isBlocked: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBlocked).toBe(false);
    });

    it('PUT /admin/users/:id/status — self-deactivation returns 400', async () => {
      const loginRes = await request(BASE)
        .post('/auth/login')
        .send({ email: 'admin@mamabear.id', password: 'admin' });

      const selfToken = loginRes.body.data.accessToken;
      const decoded = JSON.parse(
        Buffer.from(selfToken.split('.')[1], 'base64').toString(),
      );
      const selfId = decoded.sub;

      const res = await request(BASE)
        .put(`/admin/users/${selfId}/status`)
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ isBlocked: true })
        .expect(400);

      expect(res.body.message).toContain('Cannot change your own status');
    });


    it('PUT /admin/users/:id/status — ADMIN cannot access (SUPERADMIN-only)', async () => {
      if (!state.adminUserId) return;
      const res = await request(BASE)
        .put(`/admin/users/${state.adminUserId}/status`)
        .set('Authorization', `Bearer ${state.adminToken}`)
        .send({ isBlocked: true })
        .expect(403);
    });

    it('DELETE /admin/users/:id — ADMIN cannot access (SUPERADMIN-only)', async () => {
      if (!state.adminUserId) return;
      const res = await request(BASE)
        .delete(`/admin/users/${state.adminUserId}`)
        .set('Authorization', `Bearer ${state.adminToken}`)
        .expect(403);
    });
  });

  describe('Admin — Update', () => {
    it('PUT /admin/products/:id', async () => {
      const res = await request(BASE)
        .put(`/admin/products/${state.productId}`)
        .set(authHeader())
        .send({ name: `Smoke Product Updated ${runId}`, priceIdr: 55000 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PUT /admin/products/variants/:id', async () => {
      const res = await request(BASE)
        .put(`/admin/products/variants/${state.variantId}`)
        .set(authHeader())
        .send({ name: `Smoke Variant Updated ${runId}`, priceIdr: 45000 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PUT /admin/categories/:id', async () => {
      const res = await request(BASE)
        .put(`/admin/categories/${state.categoryId}`)
        .set(authHeader())
        .send({ name: `Smoke Category Updated ${runId}` })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PATCH /admin/highlights/:id', async () => {
      const res = await request(BASE)
        .patch(`/admin/highlights/${state.highlightId}`)
        .set(authHeader())
        .send({ name: `Smoke Highlight Updated ${runId}` })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Review interaction', () => {
    it('PATCH /products/:slug/reviews/:reviewId/upvote', async () => {
      const res = await request(BASE)
        .patch(
          `/products/${state.productSlug}/reviews/${state.reviewId}/upvote`,
        )
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
  

  describe('Admin — Delete', () => {
    it('DELETE /admin/products/:id/reviews/:reviewId', async () => {
      const res = await request(BASE)
        .delete(
          `/admin/products/${state.productId}/reviews/${state.reviewId}`,
        )
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /admin/products/variants/:id', async () => {
      const res = await request(BASE)
        .delete(`/admin/products/variants/${state.variantId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /admin/products/:id — may fail with 409 if referenced by orders', async () => {
      const res = await request(BASE)
        .delete(`/admin/products/${state.productId}`)
        .set(authHeader());

      expect([200, 409]).toContain(res.status);
    });

    it('DELETE /admin/categories/:id', async () => {
      const res = await request(BASE)
        .delete(`/admin/categories/${state.categoryId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /admin/highlights/:id', async () => {
      const res = await request(BASE)
        .delete(`/admin/highlights/${state.highlightId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PUT /admin/users/:id/status — can deactivate non-last superadmin', async () => {
      const createRes = await request(BASE)
        .post('/admin/users')
        .set(authHeader())
        .send({
          email: `super-extra-${runId}@test.com`,
          password: 'password123',
          name: `Super Extra ${runId}`,
          phone: '081234567895',
        });
      if (!createRes.body.success) return;
      const extraSuperId = createRes.body.data.id;

      await request(BASE)
        .put(`/admin/users/${extraSuperId}/role`)
        .set(authHeader())
        .send({ role: 'SUPERADMIN' });

      const res = await request(BASE)
        .put(`/admin/users/${extraSuperId}/status`)
        .set(authHeader())
        .send({ isBlocked: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isBlocked).toBe(true);

      await request(BASE)
        .put(`/admin/users/${extraSuperId}/status`)
        .set(authHeader())
        .send({ isBlocked: false });
      await request(BASE).delete(`/admin/users/${extraSuperId}`).set(authHeader());
    });

    it('DELETE /admin/users/:id', async () => {
      const res = await request(BASE)
        .delete(`/admin/users/${state.userId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

});
