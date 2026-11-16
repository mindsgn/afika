import { eq } from 'drizzle-orm';
import { business } from './schema';
import { makeTestDb } from './testDb';
import { saveBusiness } from '@/services/business';
import { createProduct, listProducts } from '@/services/catalog';

describe('makeTestDb', () => {
  it('runs the real schema and services in plain Node', () => {
    const db = makeTestDb();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    createProduct(db, {
      sku: 'FLATWHITE',
      name: 'Flat White',
      categoryId: null,
      price: 3200,
      costPrice: 1200,
      stock: 20,
    });
    const products = listProducts(db);
    expect(products).toHaveLength(1);
    expect(products[0].sku).toBe('FLATWHITE');
    expect(products[0].stock).toBe(20);
    expect(db.select().from(business).where(eq(business.id, 1)).get()?.name).toBe('Afika Coffee');
  });
});
