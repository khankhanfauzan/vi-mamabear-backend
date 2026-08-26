import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:3000';
const BRUNO = '/home/regen/Documents/mamabear-backend/bruno';

let jwt = '';
let refreshJwt = '';
let s = {};
let c = {};
const store = {};

async function api(method, path, opts = {}) {
  const { body, auth = true } = opts;
  const hdrs = { 'Content-Type': 'application/json' };
  if (auth && jwt) hdrs['Authorization'] = `Bearer ${jwt}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = txt; }
    return { status: res.status, statusText: res.statusText, ct: res.headers.get('content-type') || 'application/json; charset=utf-8', body: json };
  } catch (e) {
    return { status: 0, statusText: 'Network Error', ct: '', body: { error: e.message } };
  }
}

function add(file, name, method, path, reqBody, res) {
  if (!store[file]) store[file] = [];
  store[file].push({ name, method, path, reqBody, res });
}

function buildExamplesYaml(examples) {
  const parts = ['examples:'];
  for (const ex of examples) {
    parts.push(`  - name: "${ex.name}"`);
    parts.push('    request:');
    parts.push(`      url: "{{baseUrl}}${ex.path}"`);
    parts.push(`      method: ${ex.method}`);
    if (ex.reqBody !== undefined) {
      parts.push('      body:');
      parts.push('        type: json');
      parts.push('        data: |-');
      const json = JSON.stringify(ex.reqBody, null, 2);
      for (const line of json.split('\n')) parts.push(`          ${line}`);
    }
    parts.push('    response:');
    parts.push(`      status: ${ex.res.status}`);
    parts.push(`      statusText: "${ex.res.statusText}"`);
    parts.push('      headers:');
    parts.push(`        - name: Content-Type`);
    parts.push(`          value: "${ex.res.ct}"`);
    parts.push('      body:');
    parts.push('        type: json');
    parts.push('        data: |-');
    const resJson = typeof ex.res.body === 'string' ? ex.res.body : JSON.stringify(ex.res.body, null, 2);
    for (const line of resJson.split('\n')) parts.push(`          ${line}`);
  }
  return parts.join('\n') + '\n';
}

function writeFile(relPath, examples) {
  const filePath = join(BRUNO, relPath);
  const content = readFileSync(filePath, 'utf-8');
  const yaml = buildExamplesYaml(examples);
  const idx = content.indexOf('\nexamples:');
  let newContent;
  if (idx !== -1) {
    newContent = content.slice(0, idx) + '\n' + yaml;
  } else {
    newContent = content.trimEnd() + '\n\n' + yaml;
  }
  writeFileSync(filePath, newContent);
}

function log(file, name, status) {
  console.log(`  [${status}] ${file} -> ${name}`);
}

// ============================================================
// PHASE 1: Root & Health
// ============================================================
console.log('\n=== Phase 1: Root & Health ===');

{
  const r = await api('GET', '/', { auth: false });
  add('Get endpoint root.yml', 'Success (200)', 'GET', '/', undefined, r);
  log('Get endpoint root.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', '/health', { auth: false });
  add('Healthcheck.yml', 'Success (200)', 'GET', '/health', undefined, r);
  log('Healthcheck.yml', 'Success (200)', r.status);
}

// ============================================================
// PHASE 2: Login
// ============================================================
console.log('\n=== Phase 2: Login ===');

{
  const body = { email: 'admin@mamabear.id', password: 'admin' };
  const r = await api('POST', '/api/auth/login', { body, auth: false });
  if (!r.body.data) {
    console.error(`Login failed! Status: ${r.status}`, JSON.stringify(r.body).slice(0, 200));
    process.exit(1);
  }
  jwt = r.body.data.accessToken;
  refreshJwt = r.body.data.refreshToken;
  add('auth/Login.yml', `Success (${r.status})`, 'POST', '/api/auth/login', body, r);
  log('auth/Login.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 3: Read seed data
// ============================================================
console.log('\n=== Phase 3: Read seed data ===');

{
  const r = await api('GET', '/products?limit=10&cursor=1', { auth: false });
  const products = r.body.data.data || r.body.data;
  s.productSlug = products[0].slug;
  s.productId = products[0].id;
  s.product2Slug = products[1].slug;
  add('products/Get products (Pagination).yml', 'Success (200)', 'GET', '/products?limit=10&cursor=1', undefined, r);
  log('products/Get products (Pagination).yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', '/categories', { auth: false });
  s.categorySlug = r.body.data[0].slug;
  s.categoryId = r.body.data[0].id;
  s.category2Slug = r.body.data[1].slug;
  add('category/Get categories.yml', 'Success (200)', 'GET', '/categories', undefined, r);
  log('category/Get categories.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', '/highlights', { auth: false });
  s.highlightId = r.body.data[0].id;
  add('highlights/Get highlights.yml', 'Success (200)', 'GET', '/highlights', undefined, r);
  log('highlights/Get highlights.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', '/api/users');
  s.userId = r.body.data[0].id;
  add('users/Get users.yml', 'Success (200)', 'GET', '/api/users', undefined, r);
  log('users/Get users.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/products/${s.productSlug}`, { auth: false });
  s.variantId = r.body.data.variants[0].id;
  add('products/Get one product.yml', 'Success (200)', 'GET', `/products/${s.productSlug}`, undefined, r);
  log('products/Get one product.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/products/${s.productSlug}/variants`, { auth: false });
  add('products/Get product variants.yml', 'Success (200)', 'GET', `/products/${s.productSlug}/variants`, undefined, r);
  log('products/Get product variants.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/products/${s.productSlug}/reviews?limit=10&cursor=1`, { auth: false });
  const reviews = r.body.data?.data || r.body.data;
  if (Array.isArray(reviews) && reviews.length > 0) s.reviewId = reviews[0].id;
  add('products/Get product reviews.yml', 'Success (200)', 'GET', `/products/${s.productSlug}/reviews?limit=10&cursor=1`, undefined, r);
  log('products/Get product reviews.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/categories/${s.categorySlug}`, { auth: false });
  add('category/Get category by slug.yml', 'Success (200)', 'GET', `/categories/${s.categorySlug}`, undefined, r);
  log('category/Get category by slug.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/api/users/${s.userId}`);
  add('users/Get user.yml', 'Success (200)', 'GET', `/api/users/${s.userId}`, undefined, r);
  log('users/Get user.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/highlights/${s.highlightId}`, { auth: false });
  add('highlights/Get highlight.yml', 'Success (200)', 'GET', `/highlights/${s.highlightId}`, undefined, r);
  log('highlights/Get highlight.yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/api/products/${s.productId}/variants`);
  add('products/Get product variants (Admin).yml', 'Success (200)', 'GET', `/api/products/${s.productId}/variants`, undefined, r);
  log('products/Get product variants (Admin).yml', 'Success (200)', r.status);
}

{
  const r = await api('GET', `/api/products/${s.productId}/reviews?limit=10&cursor=1`);
  add('products/Get product reviews (Admin).yml', 'Success (200)', 'GET', `/api/products/${s.productId}/reviews?limit=10&cursor=1`, undefined, r);
  log('products/Get product reviews (Admin).yml', 'Success (200)', r.status);
}

// ============================================================
// PHASE 4: Create resources
// ============================================================
console.log('\n=== Phase 4: Create resources ===');

{
  const body = {
    name: 'Test Capture Product',
    description: 'A test product created by capture script',
    ingredients: 'Test ingredients',
    usageInstructions: 'Test usage instructions',
    weightG: 100,
    priceIdr: 50000,
    stock: 50,
    sku: 'TEST.CAPTURE',
    isActive: true,
    slug: 'test-capture-product',
    tags: ['test', 'capture'],
    images: [{ imageUrl: 'https://example.com/test.jpg', sortOrder: 1, altText: 'Test image' }],
  };
  const r = await api('POST', '/api/products', { body });
  if (r.status === 201 && r.body.data) {
    c.productId = r.body.data.id;
    c.productSlug = r.body.data.slug;
  }
  add('products/Create product.yml', `Success (${r.status})`, 'POST', '/api/products', body, r);
  log('products/Create product.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Test Capture Category',
    description: 'A test category for capture script',
    imageUrl: 'https://example.com/test-category.jpg',
  };
  const r = await api('POST', '/api/categories', { body });
  if (r.status === 201 && r.body.data) {
    c.categoryId = r.body.data.id;
    c.categorySlug = r.body.data.slug;
  }
  add('category/Create category.yml', `Success (${r.status})`, 'POST', '/api/categories', body, r);
  log('category/Create category.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Test Capture Highlight',
    description: 'A test highlight for capture script',
    isActive: true,
    slug: 'test-capture-highlight',
  };
  const r = await api('POST', '/api/highlights', { body });
  if (r.status === 201 && r.body.data) {
    c.highlightId = r.body.data.id;
  }
  add('highlights/Create highlight.yml', `Success (${r.status})`, 'POST', '/api/highlights', body, r);
  log('highlights/Create highlight.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    email: 'test-capture@example.com',
    password: 'password123',
    name: 'Test Capture User',
    phone: '081234567890',
  };
  const r = await api('POST', '/api/users', { body });
  if (r.status === 201 && r.body.data) {
    c.userId = r.body.data.id;
  }
  add('users/Create user.yml', `Success (${r.status})`, 'POST', '/api/users', body, r);
  log('users/Create user.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Test Capture Variant',
    priceIdr: 50000,
    weightG: 100,
    sku: 'TEST.CAPTURE.VAR',
    stock: 50,
    sortOrder: 0,
  };
  const path = `/api/products/${c.productId}/variants`;
  const r = await api('POST', path, { body });
  if (r.status === 201 && r.body.data) {
    c.variantId = r.body.data.id;
  }
  add('products/Create variant.yml', `Success (${r.status})`, 'POST', path, body, r);
  log('products/Create variant.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    title: 'Great product!',
    reviewerId: c.userId || s.userId,
    description: 'This is a test review from the capture script.',
    rating: 5,
    imageUrls: ['https://example.com/review-img1.jpg'],
  };
  const path = `/products/${c.productSlug}/reviews`;
  const r = await api('POST', path, { body });
  if (r.status === 201 && r.body.data) {
    c.reviewId = r.body.data.id;
  }
  add('products/Create product review.yml', `Success (${r.status})`, 'POST', path, body, r);
  log('products/Create product review.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    isPercent: false,
    amount: 5000,
    startedAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
  };
  const path = `/api/products/${c.productId}/variants/${c.variantId}/discount`;
  const r = await api('POST', path, { body });
  add('products/Create discount.yml', `Success (${r.status})`, 'POST', path, body, r);
  log('products/Create discount.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 5: Update resources
// ============================================================
console.log('\n=== Phase 5: Update resources ===');

{
  const body = {
    name: 'Updated Test Capture Product',
    description: 'Updated description',
    slug: 'test-capture-product-updated',
    priceIdr: 55000,
    stock: 60,
  };
  const path = `/api/products/${c.productId}`;
  const r = await api('PUT', path, { body });
  if (r.status === 200 && r.body.data) c.productSlug = r.body.data.slug;
  add('products/Update product.yml', `Success (${r.status})`, 'PUT', path, body, r);
  log('products/Update product.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Updated Test Category',
    description: 'Updated description',
    slug: 'test-category-updated',
  };
  const path = `/api/categories/${c.categoryId}`;
  const r = await api('PUT', path, { body });
  if (r.status === 200 && r.body.data) c.categorySlug = r.body.data.slug;
  add('category/Update category.yml', `Success (${r.status})`, 'PUT', path, body, r);
  log('category/Update category.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Updated Test Highlight',
    description: 'Updated description',
    slug: 'test-highlight-updated',
  };
  const path = `/api/highlights/${c.highlightId}`;
  const r = await api('PATCH', path, { body });
  add('highlights/Update highlight.yml', `Success (${r.status})`, 'PATCH', path, body, r);
  log('highlights/Update highlight.yml', `Success (${r.status})`, r.status);
}

{
  const body = { name: 'Updated Capture User' };
  const path = `/api/users/${c.userId}`;
  const r = await api('PATCH', path, { body });
  add('users/Update user.yml', `Success (${r.status})`, 'PATCH', path, body, r);
  log('users/Update user.yml', `Success (${r.status})`, r.status);
}

{
  const body = {
    name: 'Updated Test Variant',
    priceIdr: 55000,
    stock: 60,
  };
  const path = `/api/products/variants/${c.variantId}`;
  const r = await api('PUT', path, { body });
  add('variants/Update variant.yml', `Success (${r.status})`, 'PUT', path, body, r);
  log('variants/Update variant.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 6: Interact
// ============================================================
console.log('\n=== Phase 6: Interact ===');

{
  const path = `/products/${c.productSlug}/reviews/${c.reviewId}/upvote`;
  const r = await api('PATCH', path);
  add('products/Upvote review.yml', `Success (${r.status})`, 'PATCH', path, undefined, r);
  log('products/Upvote review.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 7: Delete resources
// ============================================================
console.log('\n=== Phase 7: Delete resources ===');

{
  const path = `/api/products/${c.productId}/reviews/${c.reviewId}`;
  const r = await api('DELETE', path);
  add('products/Delete product review (Admin).yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('products/Delete product review (Admin).yml', `Success (${r.status})`, r.status);
}

{
  const path = `/api/products/variants/${c.variantId}`;
  const r = await api('DELETE', path);
  add('variants/Delete variant.yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('variants/Delete variant.yml', `Success (${r.status})`, r.status);
}

{
  const path = `/api/products/${c.productId}`;
  const r = await api('DELETE', path);
  add('products/Delete product.yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('products/Delete product.yml', `Success (${r.status})`, r.status);
}

{
  const path = `/api/categories/${c.categoryId}`;
  const r = await api('DELETE', path);
  add('category/Delete category.yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('category/Delete category.yml', `Success (${r.status})`, r.status);
}

{
  const path = `/api/highlights/${c.highlightId}`;
  const r = await api('DELETE', path);
  add('highlights/Delete highlight.yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('highlights/Delete highlight.yml', `Success (${r.status})`, r.status);
}

{
  const path = `/api/users/${c.userId}`;
  const r = await api('DELETE', path);
  add('users/Delete user.yml', `Success (${r.status})`, 'DELETE', path, undefined, r);
  log('users/Delete user.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 8: Auth cleanup
// ============================================================
console.log('\n=== Phase 8: Auth cleanup ===');

{
  const body = { refreshToken: refreshJwt };
  const r = await api('POST', '/api/auth/refresh', { body, auth: false });
  if (r.status === 200 && r.body.data) jwt = r.body.data.accessToken;
  add('auth/Refresh token.yml', `Success (${r.status})`, 'POST', '/api/auth/refresh', body, r);
  log('auth/Refresh token.yml', `Success (${r.status})`, r.status);
}

{
  const r = await api('POST', '/api/auth/logout');
  add('auth/Logout.yml', `Success (${r.status})`, 'POST', '/api/auth/logout', undefined, r);
  log('auth/Logout.yml', `Success (${r.status})`, r.status);
}

// ============================================================
// PHASE 9: Re-login for error scenarios
// ============================================================
console.log('\n=== Re-login for error scenarios ===');
{
  const r = await api('POST', '/api/auth/login', {
    body: { email: 'admin@mamabear.id', password: 'admin' },
    auth: false,
  });
  jwt = r.body.data.accessToken;
  refreshJwt = r.body.data.refreshToken;
  console.log(`  Re-login: ${r.status}`);
}

// ============================================================
// PHASE 10: Error scenarios
// ============================================================
console.log('\n=== Phase 10: Error scenarios ===');

// --- Auth errors ---
console.log('\n  -- Auth errors --');

{
  const body = { email: 'admin@mamabear.id', password: 'wrongpassword' };
  const r = await api('POST', '/api/auth/login', { body, auth: false });
  add('auth/Login.yml', `Invalid Password (${r.status})`, 'POST', '/api/auth/login', body, r);
  log('auth/Login.yml', `Invalid Password (${r.status})`, r.status);
}

{
  const body = { email: 'nonexistent@email.com', password: 'password123' };
  const r = await api('POST', '/api/auth/login', { body, auth: false });
  add('auth/Login.yml', `Email Not Found (${r.status})`, 'POST', '/api/auth/login', body, r);
  log('auth/Login.yml', `Email Not Found (${r.status})`, r.status);
}

{
  const body = { email: 'not-an-email', password: '' };
  const r = await api('POST', '/api/auth/login', { body, auth: false });
  add('auth/Login.yml', `Validation Error (${r.status})`, 'POST', '/api/auth/login', body, r);
  log('auth/Login.yml', `Validation Error (${r.status})`, r.status);
}

{
  const r = await api('POST', '/api/auth/logout', { auth: false });
  add('auth/Logout.yml', `Unauthorized (${r.status})`, 'POST', '/api/auth/logout', undefined, r);
  log('auth/Logout.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { refreshToken: 'invalid-token-xyz' };
  const r = await api('POST', '/api/auth/refresh', { body, auth: false });
  add('auth/Refresh token.yml', `Invalid Refresh Token (${r.status})`, 'POST', '/api/auth/refresh', body, r);
  log('auth/Refresh token.yml', `Invalid Refresh Token (${r.status})`, r.status);
}

// --- Product public errors ---
console.log('\n  -- Product public errors --');

{
  const r = await api('GET', '/products?limit=20&cursor=0', { auth: false });
  add('products/Get products (Pagination).yml', `Validation Error (${r.status})`, 'GET', '/products?limit=20&cursor=0', undefined, r);
  log('products/Get products (Pagination).yml', `Validation Error (${r.status})`, r.status);
}

{
  const r = await api('GET', '/products/nonexistent-product-xyz', { auth: false });
  add('products/Get one product.yml', `Not Found (${r.status})`, 'GET', '/products/nonexistent-product-xyz', undefined, r);
  log('products/Get one product.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('GET', '/products/nonexistent-product-xyz/variants', { auth: false });
  add('products/Get product variants.yml', `Not Found (${r.status})`, 'GET', '/products/nonexistent-product-xyz/variants', undefined, r);
  log('products/Get product variants.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('GET', '/products/nonexistent-product-xyz/reviews', { auth: false });
  add('products/Get product reviews.yml', `Not Found (${r.status})`, 'GET', '/products/nonexistent-product-xyz/reviews', undefined, r);
  log('products/Get product reviews.yml', `Not Found (${r.status})`, r.status);
}

// --- Product admin errors ---
console.log('\n  -- Product admin errors --');

{
  const r = await api('GET', `/api/products/${s.productId}/variants`, { auth: false });
  add('products/Get product variants (Admin).yml', `Unauthorized (${r.status})`, 'GET', `/api/products/${s.productId}/variants`, undefined, r);
  log('products/Get product variants (Admin).yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('GET', `/api/products/${s.productId}/reviews?limit=10&cursor=1`, { auth: false });
  add('products/Get product reviews (Admin).yml', `Unauthorized (${r.status})`, 'GET', `/api/products/${s.productId}/reviews?limit=10&cursor=1`, undefined, r);
  log('products/Get product reviews (Admin).yml', `Unauthorized (${r.status})`, r.status);
}

// --- Create product errors ---
{
  const body = { name: 'Test' };
  const r = await api('POST', '/api/products', { body, auth: false });
  add('products/Create product.yml', `Unauthorized (${r.status})`, 'POST', '/api/products', body, r);
  log('products/Create product.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { name: '', weightG: '' };
  const r = await api('POST', '/api/products', { body });
  add('products/Create product.yml', `Validation Error (${r.status})`, 'POST', '/api/products', body, r);
  log('products/Create product.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    name: 'Duplicate Slug Product',
    description: 'Duplicate slug test',
    ingredients: 'Test',
    usageInstructions: 'Test',
    weightG: 100,
    priceIdr: 50000,
    stock: 10,
    sku: 'TEST.DUP.SLUG',
    slug: s.productSlug,
    tags: [],
    images: [],
  };
  const r = await api('POST', '/api/products', { body });
  add('products/Create product.yml', `Slug Already Exists (${r.status})`, 'POST', '/api/products', body, r);
  log('products/Create product.yml', `Slug Already Exists (${r.status})`, r.status);
}

// --- Update product errors ---
{
  const body = { slug: s.product2Slug };
  const r = await api('PUT', `/api/products/${s.productId}`, { body });
  add('products/Update product.yml', `Slug Already Exists (${r.status})`, 'PUT', `/api/products/${s.productId}`, body, r);
  log('products/Update product.yml', `Slug Already Exists (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PUT', '/api/products/999999', { body });
  add('products/Update product.yml', `Not Found (${r.status})`, 'PUT', '/api/products/999999', body, r);
  log('products/Update product.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PUT', `/api/products/${s.productId}`, { body, auth: false });
  add('products/Update product.yml', `Unauthorized (${r.status})`, 'PUT', `/api/products/${s.productId}`, body, r);
  log('products/Update product.yml', `Unauthorized (${r.status})`, r.status);
}

// --- Delete product errors ---
{
  const r = await api('DELETE', '/api/products/999999');
  add('products/Delete product.yml', `Not Found (${r.status})`, 'DELETE', '/api/products/999999', undefined, r);
  log('products/Delete product.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/products/${s.productId}`, { auth: false });
  add('products/Delete product.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/products/${s.productId}`, undefined, r);
  log('products/Delete product.yml', `Unauthorized (${r.status})`, r.status);
}

// --- Create variant errors ---
{
  const body = { name: 'Test' };
  const r = await api('POST', `/api/products/${s.productId}/variants`, { body, auth: false });
  add('products/Create variant.yml', `Unauthorized (${r.status})`, 'POST', `/api/products/${s.productId}/variants`, body, r);
  log('products/Create variant.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { name: '', priceIdr: '', weightG: '' };
  const r = await api('POST', `/api/products/${s.productId}/variants`, { body });
  add('products/Create variant.yml', `Validation Error (${r.status})`, 'POST', `/api/products/${s.productId}/variants`, body, r);
  log('products/Create variant.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    name: 'Test Variant',
    priceIdr: 50000,
    weightG: 100,
    sku: 'TEST.NOTFOUND',
    stock: 10,
    sortOrder: 0,
  };
  const r = await api('POST', '/api/products/999999/variants', { body });
  add('products/Create variant.yml', `Product Not Found (${r.status})`, 'POST', '/api/products/999999/variants', body, r);
  log('products/Create variant.yml', `Product Not Found (${r.status})`, r.status);
}

// --- Create product review errors ---
{
  const body = { title: 'Test' };
  const r = await api('POST', `/products/${s.productSlug}/reviews`, { body, auth: false });
  add('products/Create product review.yml', `Unauthorized (${r.status})`, 'POST', `/products/${s.productSlug}/reviews`, body, r);
  log('products/Create product review.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { title: '', reviewerId: '', description: '', rating: 0 };
  const r = await api('POST', `/products/${s.productSlug}/reviews`, { body });
  add('products/Create product review.yml', `Validation Error (${r.status})`, 'POST', `/products/${s.productSlug}/reviews`, body, r);
  log('products/Create product review.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    title: 'Test Review',
    reviewerId: s.userId,
    description: 'Test description',
    rating: 5,
    imageUrls: [],
  };
  const r = await api('POST', '/products/nonexistent-slug-xyz/reviews', { body });
  add('products/Create product review.yml', `Not Found (${r.status})`, 'POST', '/products/nonexistent-slug-xyz/reviews', body, r);
  log('products/Create product review.yml', `Not Found (${r.status})`, r.status);
}

// --- Create discount errors ---
{
  const body = { amount: '' };
  const r = await api('POST', `/api/products/${s.productId}/variants/${s.variantId}/discount`, { body, auth: false });
  add('products/Create discount.yml', `Unauthorized (${r.status})`, 'POST', `/api/products/${s.productId}/variants/${s.variantId}/discount`, body, r);
  log('products/Create discount.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { amount: '', endsAt: 'not-a-date' };
  const r = await api('POST', `/api/products/${s.productId}/variants/${s.variantId}/discount`, { body });
  add('products/Create discount.yml', `Validation Error (${r.status})`, 'POST', `/api/products/${s.productId}/variants/${s.variantId}/discount`, body, r);
  log('products/Create discount.yml', `Validation Error (${r.status})`, r.status);
}

// --- Upvote review errors ---
{
  const r = await api('PATCH', `/products/${s.productSlug}/reviews/${s.reviewId}/upvote`, { auth: false });
  add('products/Upvote review.yml', `Unauthorized (${r.status})`, 'PATCH', `/products/${s.productSlug}/reviews/${s.reviewId}/upvote`, undefined, r);
  log('products/Upvote review.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('PATCH', `/products/${s.productSlug}/reviews/999999/upvote`);
  add('products/Upvote review.yml', `Not Found (${r.status})`, 'PATCH', `/products/${s.productSlug}/reviews/999999/upvote`, undefined, r);
  log('products/Upvote review.yml', `Not Found (${r.status})`, r.status);
}

// --- Delete product review (Admin) errors ---
{
  const r = await api('DELETE', `/api/products/${s.productId}/reviews/999999`);
  add('products/Delete product review (Admin).yml', `Not Found (${r.status})`, 'DELETE', `/api/products/${s.productId}/reviews/999999`, undefined, r);
  log('products/Delete product review (Admin).yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/products/${s.productId}/reviews/${s.reviewId}`, { auth: false });
  add('products/Delete product review (Admin).yml', `Unauthorized (${r.status})`, 'DELETE', `/api/products/${s.productId}/reviews/${s.reviewId}`, undefined, r);
  log('products/Delete product review (Admin).yml', `Unauthorized (${r.status})`, r.status);
}

// --- Category errors ---
console.log('\n  -- Category errors --');

{
  const r = await api('GET', '/categories/nonexistent-category-xyz', { auth: false });
  add('category/Get category by slug.yml', `Not Found (${r.status})`, 'GET', '/categories/nonexistent-category-xyz', undefined, r);
  log('category/Get category by slug.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('POST', '/api/categories', { body, auth: false });
  add('category/Create category.yml', `Unauthorized (${r.status})`, 'POST', '/api/categories', body, r);
  log('category/Create category.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { name: '', description: '', imageUrl: '' };
  const r = await api('POST', '/api/categories', { body });
  add('category/Create category.yml', `Validation Error (${r.status})`, 'POST', '/api/categories', body, r);
  log('category/Create category.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    name: 'Food',
    description: 'Duplicate test',
    imageUrl: 'https://example.com/test.jpg',
  };
  const r = await api('POST', '/api/categories', { body });
  add('category/Create category.yml', `Category Already Exists (${r.status})`, 'POST', '/api/categories', body, r);
  log('category/Create category.yml', `Category Already Exists (${r.status})`, r.status);
}

{
  const body = { slug: s.category2Slug };
  const r = await api('PUT', `/api/categories/${s.categoryId}`, { body });
  add('category/Update category.yml', `Slug Collision (${r.status})`, 'PUT', `/api/categories/${s.categoryId}`, body, r);
  log('category/Update category.yml', `Slug Collision (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PUT', '/api/categories/999999', { body });
  add('category/Update category.yml', `Not Found (${r.status})`, 'PUT', '/api/categories/999999', body, r);
  log('category/Update category.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PUT', `/api/categories/${s.categoryId}`, { body, auth: false });
  add('category/Update category.yml', `Unauthorized (${r.status})`, 'PUT', `/api/categories/${s.categoryId}`, body, r);
  log('category/Update category.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', '/api/categories/999999');
  add('category/Delete category.yml', `Not Found (${r.status})`, 'DELETE', '/api/categories/999999', undefined, r);
  log('category/Delete category.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/categories/${s.categoryId}`, { auth: false });
  add('category/Delete category.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/categories/${s.categoryId}`, undefined, r);
  log('category/Delete category.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/categories/${s.categoryId}`);
  add('category/Delete category.yml', `Category Has Products (${r.status})`, 'DELETE', `/api/categories/${s.categoryId}`, undefined, r);
  log('category/Delete category.yml', `Category Has Products (${r.status})`, r.status);
}

// --- Highlight errors ---
console.log('\n  -- Highlight errors --');

{
  const r = await api('GET', '/highlights/999999', { auth: false });
  add('highlights/Get highlight.yml', `Not Found (${r.status})`, 'GET', '/highlights/999999', undefined, r);
  log('highlights/Get highlight.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('POST', '/api/highlights', { body, auth: false });
  add('highlights/Create highlight.yml', `Unauthorized (${r.status})`, 'POST', '/api/highlights', body, r);
  log('highlights/Create highlight.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { name: '' };
  const r = await api('POST', '/api/highlights', { body });
  add('highlights/Create highlight.yml', `Validation Error (${r.status})`, 'POST', '/api/highlights', body, r);
  log('highlights/Create highlight.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    name: 'New Additions',
    description: 'Duplicate test',
    slug: 'new-additions',
  };
  const r = await api('POST', '/api/highlights', { body });
  add('highlights/Create highlight.yml', `Highlight Already Exists (${r.status})`, 'POST', '/api/highlights', body, r);
  log('highlights/Create highlight.yml', `Highlight Already Exists (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PATCH', '/api/highlights/999999', { body });
  add('highlights/Update highlight.yml', `Not Found (${r.status})`, 'PATCH', '/api/highlights/999999', body, r);
  log('highlights/Update highlight.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PATCH', `/api/highlights/${s.highlightId}`, { body, auth: false });
  add('highlights/Update highlight.yml', `Unauthorized (${r.status})`, 'PATCH', `/api/highlights/${s.highlightId}`, body, r);
  log('highlights/Update highlight.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', '/api/highlights/999999');
  add('highlights/Delete highlight.yml', `Not Found (${r.status})`, 'DELETE', '/api/highlights/999999', undefined, r);
  log('highlights/Delete highlight.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/highlights/${s.highlightId}`, { auth: false });
  add('highlights/Delete highlight.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/highlights/${s.highlightId}`, undefined, r);
  log('highlights/Delete highlight.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/highlights/${s.highlightId}`);
  add('highlights/Delete highlight.yml', `Highlight Has Products (${r.status})`, 'DELETE', `/api/highlights/${s.highlightId}`, undefined, r);
  log('highlights/Delete highlight.yml', `Highlight Has Products (${r.status})`, r.status);
}

// --- User errors ---
console.log('\n  -- User errors --');

{
  const r = await api('GET', '/api/users', { auth: false });
  add('users/Get users.yml', `Unauthorized (${r.status})`, 'GET', '/api/users', undefined, r);
  log('users/Get users.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('GET', '/api/users/00000000-0000-0000-0000-000000000000');
  add('users/Get user.yml', `Not Found (${r.status})`, 'GET', '/api/users/00000000-0000-0000-0000-000000000000', undefined, r);
  log('users/Get user.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('GET', `/api/users/${s.userId}`, { auth: false });
  add('users/Get user.yml', `Unauthorized (${r.status})`, 'GET', `/api/users/${s.userId}`, undefined, r);
  log('users/Get user.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { email: 'test@test.com' };
  const r = await api('POST', '/api/users', { body, auth: false });
  add('users/Create user.yml', `Unauthorized (${r.status})`, 'POST', '/api/users', body, r);
  log('users/Create user.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const body = { email: '', password: '', name: '', phone: '' };
  const r = await api('POST', '/api/users', { body });
  add('users/Create user.yml', `Validation Error (${r.status})`, 'POST', '/api/users', body, r);
  log('users/Create user.yml', `Validation Error (${r.status})`, r.status);
}

{
  const body = {
    email: 'admin@mamabear.id',
    password: 'password123',
    name: 'Duplicate User',
    phone: '081234567890',
  };
  const r = await api('POST', '/api/users', { body });
  add('users/Create user.yml', `Email Already Exists (${r.status})`, 'POST', '/api/users', body, r);
  log('users/Create user.yml', `Email Already Exists (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PATCH', '/api/users/00000000-0000-0000-0000-000000000000', { body });
  add('users/Update user.yml', `Not Found (${r.status})`, 'PATCH', '/api/users/00000000-0000-0000-0000-000000000000', body, r);
  log('users/Update user.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PATCH', `/api/users/${s.userId}`, { body, auth: false });
  add('users/Update user.yml', `Unauthorized (${r.status})`, 'PATCH', `/api/users/${s.userId}`, body, r);
  log('users/Update user.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', '/api/users/00000000-0000-0000-0000-000000000000');
  add('users/Delete user.yml', `Not Found (${r.status})`, 'DELETE', '/api/users/00000000-0000-0000-0000-000000000000', undefined, r);
  log('users/Delete user.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/users/${s.userId}`, { auth: false });
  add('users/Delete user.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/users/${s.userId}`, undefined, r);
  log('users/Delete user.yml', `Unauthorized (${r.status})`, r.status);
}

// --- Variant errors ---
console.log('\n  -- Variant errors --');

{
  const body = { name: 'Test' };
  const r = await api('PUT', '/api/products/variants/999999', { body });
  add('variants/Update variant.yml', `Not Found (${r.status})`, 'PUT', '/api/products/variants/999999', body, r);
  log('variants/Update variant.yml', `Not Found (${r.status})`, r.status);
}

{
  const body = { name: 'Test' };
  const r = await api('PUT', `/api/products/variants/${s.variantId}`, { body, auth: false });
  add('variants/Update variant.yml', `Unauthorized (${r.status})`, 'PUT', `/api/products/variants/${s.variantId}`, body, r);
  log('variants/Update variant.yml', `Unauthorized (${r.status})`, r.status);
}

{
  const r = await api('DELETE', '/api/products/variants/999999');
  add('variants/Delete variant.yml', `Not Found (${r.status})`, 'DELETE', '/api/products/variants/999999', undefined, r);
  log('variants/Delete variant.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/products/variants/${s.variantId}`, { auth: false });
  add('variants/Delete variant.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/products/variants/${s.variantId}`, undefined, r);
  log('variants/Delete variant.yml', `Unauthorized (${r.status})`, r.status);
}

// --- Review errors ---
console.log('\n  -- Review errors --');

{
  const r = await api('DELETE', '/api/products/reviews/999999');
  add('reviews/Delete review.yml', `Not Found (${r.status})`, 'DELETE', '/api/products/reviews/999999', undefined, r);
  log('reviews/Delete review.yml', `Not Found (${r.status})`, r.status);
}

{
  const r = await api('DELETE', `/api/products/reviews/${s.reviewId}`, { auth: false });
  add('reviews/Delete review.yml', `Unauthorized (${r.status})`, 'DELETE', `/api/products/reviews/${s.reviewId}`, undefined, r);
  log('reviews/Delete review.yml', `Unauthorized (${r.status})`, r.status);
}

// ============================================================
// PHASE 11: Write all Bruno YAML files
// ============================================================
console.log('\n=== Phase 11: Writing Bruno YAML files ===');

let fileCount = 0;
for (const [file, examples] of Object.entries(store)) {
  console.log(`  ${file}: ${examples.length} examples`);
  writeFile(file, examples);
  fileCount++;
}

console.log(`\nDone! Updated ${fileCount} files with real captured responses.`);
