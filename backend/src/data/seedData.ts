import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEMO_DB_PATH = path.join(__dirname, 'demo.db');

// Regions, categories, and rep data
const REGIONS = ['North', 'South', 'East', 'Southeast'];
const CATEGORIES = ['Electronics', 'Apparel', 'Home & Garden', 'Sports', 'Food & Beverage', 'Office Supplies'];
const BRANDS = ['TechMax', 'StylePro', 'HomeEase', 'SportFit', 'FreshCo', 'OfficePlus'];

const SALES_REPS: { name: string; region: string }[] = [
  { name: 'Alice Johnson', region: 'North' },
  { name: 'Bob Smith', region: 'North' },
  { name: 'Carol Davis', region: 'North' },
  { name: 'David Brown', region: 'North' },
  { name: 'Emma Wilson', region: 'North' },
  { name: 'Frank Miller', region: 'South' },
  { name: 'Grace Lee', region: 'South' },
  { name: 'Henry Taylor', region: 'South' },
  { name: 'Ivy Chen', region: 'South' },
  { name: 'Jack Anderson', region: 'South' },
  { name: 'Kate Martinez', region: 'South' },
  { name: 'Liam Garcia', region: 'East' },
  { name: 'Mia Rodriguez', region: 'East' },
  { name: 'Noah Thomas', region: 'East' },
  { name: 'Olivia White', region: 'East' },
  { name: 'Peter Harris', region: 'East' },
  { name: 'Quinn Clark', region: 'Southeast' },
  { name: 'Rachel Lewis', region: 'Southeast' },
  { name: 'Sam Walker', region: 'Southeast' },
  { name: 'Tina Hall', region: 'Southeast' },
  { name: 'Uma Allen', region: 'Southeast' },
  { name: 'Victor Young', region: 'Southeast' },
  { name: 'Wendy King', region: 'Southeast' }
];

const PRODUCTS: { name: string; category: string; brand: string; costPrice: number }[] = [];

// Generate products
const productNames: Record<string, string[]> = {
  'Electronics': ['Smartphone X1', 'Laptop Pro', 'Wireless Earbuds', 'Smart Watch', 'Tablet Ultra', '4K Monitor'],
  'Apparel': ['Cotton T-Shirt', 'Denim Jeans', 'Winter Jacket', 'Running Shoes', 'Formal Shirt', 'Casual Dress'],
  'Home & Garden': ['Garden Tool Set', 'Indoor Plant Kit', 'LED Lamp', 'Kitchen Blender', 'Air Purifier', 'Vacuum Cleaner'],
  'Sports': ['Yoga Mat', 'Dumbbells Set', 'Running Watch', 'Basketball', 'Tennis Racket', 'Cycling Helmet'],
  'Food & Beverage': ['Organic Coffee', 'Green Tea Pack', 'Protein Bars', 'Energy Drinks', 'Snack Mix', 'Dried Fruits'],
  'Office Supplies': ['Notebook Set', 'Pen Collection', 'Desk Organizer', 'Stapler Pro', 'Paper Shredder', 'Whiteboard']
};

CATEGORIES.forEach((category, catIndex) => {
  productNames[category].forEach((name) => {
    PRODUCTS.push({
      name,
      category,
      brand: BRANDS[catIndex],
      costPrice: 10 + Math.random() * 490
    });
  });
});

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export async function initializeDatabase(): Promise<void> {
  // Check if database already exists
  if (fs.existsSync(DEMO_DB_PATH)) {
    console.log('Demo database already exists, skipping initialization');
    return;
  }

  console.log('Initializing demo database...');

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS sales_reps (
      rep_id INTEGER PRIMARY KEY,
      rep_name TEXT NOT NULL,
      region TEXT NOT NULL,
      hire_date TEXT,
      target REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      product_id INTEGER PRIMARY KEY,
      product_name TEXT NOT NULL,
      product_category TEXT NOT NULL,
      brand TEXT,
      cost_price REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      region TEXT NOT NULL,
      rep_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      revenue REAL NOT NULL,
      units_sold INTEGER NOT NULL,
      discount_pct REAL,
      return_rate REAL,
      FOREIGN KEY (rep_id) REFERENCES sales_reps(rep_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )
  `);

  // Insert sales reps
  SALES_REPS.forEach((rep, index) => {
    db.run(
      `INSERT INTO sales_reps (rep_id, rep_name, region, hire_date, target) VALUES (?, ?, ?, ?, ?)`,
      [
        index + 1,
        rep.name,
        rep.region,
        randomDate(new Date('2020-01-01'), new Date('2023-06-01')),
        randomFloat(100000, 500000)
      ]
    );
  });

  // Insert products
  PRODUCTS.forEach((product, index) => {
    db.run(
      `INSERT INTO products (product_id, product_name, product_category, brand, cost_price) VALUES (?, ?, ?, ?, ?)`,
      [
        index + 1,
        product.name,
        product.category,
        product.brand,
        product.costPrice
      ]
    );
  });

  // Insert sales records (1200+ records with anomalies)
  const startDate = new Date('2023-01-01');
  const endDate = new Date('2024-12-31');
  let saleCount = 0;

  // Generate sales for each month
  for (let year = 2023; year <= 2024; year++) {
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      // Skip if before start date or after end date
      if (monthEnd < startDate || monthStart > endDate) continue;

      // Normal monthly sales: 40-60 transactions per month
      let salesThisMonth = randomInt(40, 60);

      // ANOMALY 1: August 2023 spike - triple the sales
      if (year === 2023 && month === 7) {
        salesThisMonth = randomInt(150, 180);
      }

      for (let i = 0; i < salesThisMonth; i++) {
        const region = REGIONS[randomInt(0, REGIONS.length - 1)];
        const regionReps = SALES_REPS
          .map((rep, idx) => ({ ...rep, id: idx + 1 }))
          .filter(r => r.region === region);
        const rep = regionReps[randomInt(0, regionReps.length - 1)];
        const product = PRODUCTS[randomInt(0, PRODUCTS.length - 1)];
        const productId = PRODUCTS.indexOf(product) + 1;

        let baseRevenue = randomFloat(500, 15000);

        // ANOMALY 1: August 2023 higher revenue per transaction
        if (year === 2023 && month === 7) {
          baseRevenue *= randomFloat(1.5, 2.5);
        }

        // ANOMALY 2: Southeast Q1 2024 dip (18%+ below average)
        if (region === 'Southeast' && year === 2024 && month >= 0 && month <= 2) {
          baseRevenue *= 0.65;
        }

        const saleDate = randomDate(monthStart, monthEnd);
        const unitsSold = randomInt(1, 50);
        const discountPct = randomFloat(0, 25);
        const returnRate = randomFloat(0, 10);

        db.run(
          `INSERT INTO sales (date, region, rep_id, product_id, revenue, units_sold, discount_pct, return_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleDate,
            region,
            rep.id,
            productId,
            baseRevenue,
            unitsSold,
            discountPct,
            returnRate
          ]
        );
        saleCount++;
      }
    }
  }

  console.log(`Inserted ${saleCount} sales records`);

  // Create indexes for better query performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_region ON sales(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_rep ON sales(rep_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id)`);

  // Save to file
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DEMO_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DEMO_DB_PATH, buffer);

  console.log('Demo database initialized successfully');
  db.close();
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase()
    .then(() => console.log('Database seeded'))
    .catch(console.error);
}
