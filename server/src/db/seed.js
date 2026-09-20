const bcrypt = require('bcryptjs');
const { getDb } = require('./schema');

function seedDatabase() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    console.log('ℹ️  Database already seeded, skipping...');
    return;
  }

  console.log('🌱 Seeding database...');

  // Roles
  const roles = [
    { name: 'Owner', permissions: JSON.stringify({ all: true }) },
    { name: 'Manager', permissions: JSON.stringify({ sales: true, inventory: true, purchases: true, customers: true, suppliers: true, reports: true }) },
    { name: 'Billing Staff', permissions: JSON.stringify({ sales: true, customers: true }) },
    { name: 'Inventory Staff', permissions: JSON.stringify({ inventory: true, purchases: true }) },
  ];

  const insertRole = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)');
  roles.forEach(r => insertRole.run(r.name, r.permissions));

  // Default admin user
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, username, password, role_id) VALUES (?, ?, ?, 1)')
    .run('Shop Owner', 'admin', hashedPassword);

  // Shop settings
  const settings = [
    ['shop_name', 'Munna Readymade Garments'],
    ['shop_location', 'Dhobwal Bazzar'],
    ['shop_tagline', 'Quality Fashion, Affordable Prices'],
    ['shop_phone', '+91 9876543210'],
    ['shop_whatsapp', '+919876543210'],
    ['shop_email', 'munnagarments@gmail.com'],
    ['shop_address', 'Dhobwal Bazzar, Jalandhar'],
    ['shop_city', 'Jalandhar'],
    ['shop_state', 'Punjab'],
    ['shop_pincode', '144001'],
    ['shop_gstin', '03AAAAA0000A1Z5'],
    ['shop_website', ''],
    ['shop_google_maps', 'https://maps.google.com/?q=Dhobwal+Bazzar+Jalandhar'],
    ['shop_instagram', ''],
    ['invoice_prefix', 'MRG'],
    ['invoice_counter', '0'],
    ['invoice_year', '2026'],
    ['currency', 'INR'],
    ['currency_symbol', '₹'],
    ['gst_type', 'CGST_SGST'],
    ['primary_color', '#C9A96E'],
    ['accent_color', '#8B7355'],
    ['auto_backup', 'true'],
    ['backup_frequency', 'daily'],
    ['backup_keep', '30'],
    ['show_catalogue', 'true'],
    ['catalogue_show_price', 'true'],
    ['catalogue_show_stock', 'false'],
    ['return_policy', 'Exchange within 7 days with original bill. No cash refund on sale items.'],
    ['terms_conditions', 'All prices inclusive of applicable taxes. Subject to availability.'],
    ['thank_you_message', 'Thank you for shopping at Munna Readymade Garments! Visit again.'],
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO shop_settings (key, value) VALUES (?, ?)');
  settings.forEach(([k, v]) => insertSetting.run(k, v));

  // Categories
  const categories = [
    { name: "Men's Wear", slug: 'mens-wear', gender: 'Men' },
    { name: "Women's Wear", slug: 'womens-wear', gender: 'Women' },
    { name: "Kids' Wear", slug: 'kids-wear', gender: 'Kids' },
    { name: 'Shirts', slug: 'shirts', gender: 'Men' },
    { name: 'T-Shirts', slug: 't-shirts', gender: 'Unisex' },
    { name: 'Jeans', slug: 'jeans', gender: 'Unisex' },
    { name: 'Trousers', slug: 'trousers', gender: 'Men' },
    { name: 'Ethnic Wear', slug: 'ethnic-wear', gender: 'Unisex' },
    { name: 'Salwar Kameez', slug: 'salwar-kameez', gender: 'Women' },
    { name: 'Kurtas', slug: 'kurtas', gender: 'Unisex' },
    { name: 'Jackets', slug: 'jackets', gender: 'Unisex' },
    { name: 'Accessories', slug: 'accessories', gender: 'Unisex' },
  ];

  const insertCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
  categories.forEach(c => insertCat.run(c.name, c.slug));

  // Sample products
  const sampleProducts = [
    {
      name: 'Classic White Formal Shirt',
      slug: 'classic-white-formal-shirt',
      sku: 'MRG-SHT-001',
      category_id: 4,
      brand: 'Arrow',
      fabric: 'Cotton',
      pattern: 'Plain',
      gender: 'Men',
      hsn_code: '6205',
      gst_rate: 5,
      mrp: 1299,
      purchase_price: 620,
      selling_price: 999,
      min_stock: 10,
      description: 'Premium cotton formal shirt perfect for office wear',
      show_in_catalogue: 1,
      is_new_arrival: 1,
    },
    {
      name: 'Blue Denim Jeans',
      slug: 'blue-denim-jeans',
      sku: 'MRG-JNS-001',
      category_id: 6,
      brand: 'Levi\'s Style',
      fabric: 'Denim',
      pattern: 'Plain',
      gender: 'Men',
      hsn_code: '6203',
      gst_rate: 12,
      mrp: 1799,
      purchase_price: 780,
      selling_price: 1399,
      min_stock: 8,
      description: 'Classic blue denim jeans for everyday comfort',
      show_in_catalogue: 1,
      is_featured: 1,
    },
    {
      name: 'Cotton Round Neck T-Shirt',
      slug: 'cotton-round-neck-tshirt',
      sku: 'MRG-TSH-001',
      category_id: 5,
      brand: 'Basics',
      fabric: '100% Cotton',
      pattern: 'Plain',
      gender: 'Unisex',
      hsn_code: '6109',
      gst_rate: 5,
      mrp: 599,
      purchase_price: 220,
      selling_price: 449,
      min_stock: 15,
      description: 'Comfortable everyday cotton T-shirt',
      show_in_catalogue: 1,
      is_best_seller: 1,
    },
    {
      name: 'Floral Salwar Kameez Set',
      slug: 'floral-salwar-kameez-set',
      sku: 'MRG-SKS-001',
      category_id: 9,
      brand: 'Ethnic Craft',
      fabric: 'Georgette',
      pattern: 'Floral',
      gender: 'Women',
      hsn_code: '6211',
      gst_rate: 5,
      mrp: 2499,
      purchase_price: 1100,
      selling_price: 1899,
      min_stock: 5,
      description: 'Beautiful floral printed salwar kameez set with dupatta',
      show_in_catalogue: 1,
      is_featured: 1,
    },
    {
      name: 'Kids Cotton Frock',
      slug: 'kids-cotton-frock',
      sku: 'MRG-KDF-001',
      category_id: 3,
      brand: 'Little Stars',
      fabric: 'Cotton',
      pattern: 'Printed',
      gender: 'Kids',
      hsn_code: '6209',
      gst_rate: 0,
      mrp: 799,
      purchase_price: 320,
      selling_price: 599,
      min_stock: 10,
      description: 'Adorable cotton frock for little girls',
      show_in_catalogue: 1,
      is_new_arrival: 1,
    },
    {
      name: 'Cotton Kurta',
      slug: 'cotton-kurta',
      sku: 'MRG-KRT-001',
      category_id: 10,
      brand: 'Fabindia Style',
      fabric: 'Cotton',
      pattern: 'Embroidered',
      gender: 'Men',
      hsn_code: '6205',
      gst_rate: 5,
      mrp: 1499,
      purchase_price: 650,
      selling_price: 1149,
      min_stock: 8,
      description: 'Traditional cotton kurta with subtle embroidery',
      show_in_catalogue: 1,
      is_best_seller: 1,
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products 
    (name, slug, sku, category_id, brand, fabric, pattern, gender, hsn_code, gst_rate, 
     mrp, purchase_price, selling_price, min_stock, description, show_in_catalogue, is_featured, is_new_arrival, is_best_seller)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleProducts.forEach(p => {
    insertProduct.run(
      p.name, p.slug, p.sku, p.category_id, p.brand || null, p.fabric || null,
      p.pattern || null, p.gender || null, p.hsn_code || null, p.gst_rate,
      p.mrp, p.purchase_price, p.selling_price, p.min_stock,
      p.description || null, p.show_in_catalogue || 0,
      p.is_featured || 0, p.is_new_arrival || 0, p.is_best_seller || 0
    );
  });

  // Product variants
  const sizes = {
    shirt: ['S', 'M', 'L', 'XL', 'XXL'],
    jeans: ['28', '30', '32', '34', '36'],
    tshirt: ['S', 'M', 'L', 'XL', 'XXL'],
    salwar: ['S', 'M', 'L', 'XL'],
    kids: ['2-3Y', '3-4Y', '4-5Y', '5-6Y'],
    kurta: ['S', 'M', 'L', 'XL', 'XXL'],
  };
  const colors = {
    shirt: ['White', 'Blue', 'Black'],
    jeans: ['Blue', 'Dark Blue', 'Black'],
    tshirt: ['White', 'Black', 'Red', 'Navy'],
    salwar: ['Pink', 'Blue', 'Green'],
    kids: ['Pink', 'Yellow', 'White'],
    kurta: ['White', 'Blue', 'Beige'],
  };

  const insertVariant = db.prepare(`
    INSERT INTO product_variants (product_id, size, color, variant_sku, stock, purchase_price, selling_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const productSizes = [sizes.shirt, sizes.jeans, sizes.tshirt, sizes.salwar, sizes.kids, sizes.kurta];
  const productColors = [colors.shirt, colors.jeans, colors.tshirt, colors.salwar, colors.kids, colors.kurta];
  const productIds = [1, 2, 3, 4, 5, 6];
  const skuPrefixes = ['SHT001', 'JNS001', 'TSH001', 'SKS001', 'KDF001', 'KRT001'];

  productIds.forEach((pid, pidx) => {
    const p = sampleProducts[pidx];
    productSizes[pidx].forEach(size => {
      productColors[pidx].forEach(color => {
        const variantSku = `MRG-${skuPrefixes[pidx]}-${size}-${color.substring(0, 3).toUpperCase()}`;
        const stock = Math.floor(Math.random() * 20) + 2;
        insertVariant.run(pid, size, color, variantSku, stock, p.purchase_price, p.selling_price);
      });
    });
  });

  // Sample customers
  const customers = [
    { name: 'Rajesh Kumar', phone: '9876543001', email: 'rajesh@email.com', address: 'Mohalla Ram Nagar, Jalandhar', city: 'Jalandhar', state: 'Punjab' },
    { name: 'Priya Sharma', phone: '9876543002', email: 'priya@email.com', address: 'Model Town, Jalandhar', city: 'Jalandhar', state: 'Punjab' },
    { name: 'Amit Singh', phone: '9876543003', email: '', address: 'Civil Lines, Jalandhar', city: 'Jalandhar', state: 'Punjab' },
    { name: 'Sunita Devi', phone: '9876543004', email: '', address: 'Basti Bawa Khel, Jalandhar', city: 'Jalandhar', state: 'Punjab' },
    { name: 'Mohammad Imran', phone: '9876543005', email: '', address: 'Dhobwal, Jalandhar', city: 'Jalandhar', state: 'Punjab' },
  ];

  const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, address, city, state) VALUES (?, ?, ?, ?, ?, ?)');
  customers.forEach(c => insertCustomer.run(c.name, c.phone, c.email, c.address, c.city, c.state));

  // Sample suppliers
  const suppliers = [
    { name: 'Ramesh Textile', company: 'Ramesh Textile Pvt Ltd', phone: '9812345001', email: 'ramesh@textile.com', address: 'Ludhiana Textile Market', city: 'Ludhiana', state: 'Punjab', gstin: '03BBBBB0001B1Z5' },
    { name: 'Fashion Hub', company: 'Fashion Hub Wholesale', phone: '9812345002', email: 'fashion@hub.com', address: 'Gandhi Nagar, Delhi', city: 'Delhi', state: 'Delhi', gstin: '07CCCCC0002C1Z5' },
    { name: 'Punjab Garments', company: 'Punjab Garments Traders', phone: '9812345003', email: '', address: 'GT Road, Phagwara', city: 'Phagwara', state: 'Punjab', gstin: '' },
  ];

  const insertSupplier = db.prepare('INSERT INTO suppliers (name, company, phone, email, address, city, state, gstin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  suppliers.forEach(s => insertSupplier.run(s.name, s.company, s.phone, s.email, s.address, s.city, s.state, s.gstin));

  // Sample sales (last 30 days)
  const today = new Date();
  let invoiceCounter = 0;

  const insertSale = db.prepare(`
    INSERT INTO sales (invoice_number, customer_id, customer_name, customer_phone, date, subtotal, 
      discount_amount, gst_amount, cgst_amount, sgst_amount, total_amount, paid_amount, due_amount, 
      payment_method, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, size, color, quantity, 
      selling_price, purchase_price, discount_percent, discount_amount, gst_rate, gst_amount, cgst_amount, sgst_amount, total_amount, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStockMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, 
      previous_stock, new_stock, reference_type, reference_id, reference_number, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const updateVariantStock = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?');
  const getVariant = db.prepare('SELECT * FROM product_variants WHERE id = ?');

  // Generate 30 days of sales
  for (let d = 30; d >= 0; d--) {
    const saleDate = new Date(today);
    saleDate.setDate(today.getDate() - d);
    const dateStr = saleDate.toISOString().split('T')[0];

    const numSales = Math.floor(Math.random() * 4) + 1;

    for (let s = 0; s < numSales; s++) {
      invoiceCounter++;
      const year = saleDate.getFullYear();
      const invNum = `MRG-${year}-${String(invoiceCounter).padStart(4, '0')}`;

      const customerId = Math.random() > 0.3 ? Math.floor(Math.random() * 5) + 1 : null;
      const customerInfo = customerId ? customers[customerId - 1] : null;

      // Pick 1-3 random products
      const numItems = Math.floor(Math.random() * 3) + 1;
      let subtotal = 0;
      const saleItemsData = [];

      for (let i = 0; i < numItems; i++) {
        const prodIdx = Math.floor(Math.random() * sampleProducts.length);
        const prod = sampleProducts[prodIdx];
        const prodId = prodIdx + 1;
        const qty = Math.floor(Math.random() * 2) + 1;
        const discPct = [0, 0, 5, 10][Math.floor(Math.random() * 4)];
        const discAmt = (prod.selling_price * qty * discPct) / 100;
        const baseAmt = prod.selling_price * qty - discAmt;
        const gstAmt = (baseAmt * prod.gst_rate) / 100;
        const totalAmt = baseAmt + gstAmt;
        subtotal += prod.selling_price * qty;

        // Get a variant
        const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND stock > 0 LIMIT 1').all(prodId);
        const variant = variants.length > 0 ? variants[0] : null;

        saleItemsData.push({
          product_id: prodId, variant_id: variant?.id, product_name: prod.name,
          size: variant?.size || 'M', color: variant?.color || 'Blue',
          quantity: qty, selling_price: prod.selling_price, purchase_price: prod.purchase_price,
          discount_percent: discPct, discount_amount: discAmt, gst_rate: prod.gst_rate,
          gst_amount: gstAmt, total_amount: totalAmt,
          profit: totalAmt - (prod.purchase_price * qty),
        });
      }

      const totalDiscount = saleItemsData.reduce((a, b) => a + b.discount_amount, 0);
      const totalGst = saleItemsData.reduce((a, b) => a + b.gst_amount, 0);
      const totalAmount = saleItemsData.reduce((a, b) => a + b.total_amount, 0);
      const cgst = totalGst / 2;
      const sgst = totalGst / 2;
      const methods = ['Cash', 'Cash', 'Cash', 'UPI', 'UPI', 'Card'];
      const payMethod = methods[Math.floor(Math.random() * methods.length)];
      const isPaid = Math.random() > 0.15;
      const paid = isPaid ? totalAmount : Math.floor(totalAmount * 0.5);
      const due = totalAmount - paid;

      const saleResult = insertSale.run(
        invNum, customerId, customerInfo?.name || 'Walk-in Customer', customerInfo?.phone || null,
        dateStr, subtotal, totalDiscount, totalGst, cgst, sgst,
        totalAmount, paid, due, payMethod, 'Completed'
      );

      const saleId = saleResult.lastInsertRowid;

      saleItemsData.forEach(item => {
        insertSaleItem.run(
          saleId, item.product_id, item.variant_id, item.product_name, item.size, item.color,
          item.quantity, item.selling_price, item.purchase_price,
          item.discount_percent, item.discount_amount, item.gst_rate,
          item.gst_amount, item.gst_amount / 2, item.gst_amount / 2,
          item.total_amount, item.profit
        );

        // Update stock
        if (item.variant_id) {
          const variant = getVariant.get(item.variant_id);
          if (variant && variant.stock > 0) {
            const prevStock = variant.stock;
            const newStock = Math.max(0, prevStock - item.quantity);
            updateVariantStock.run(item.quantity, item.variant_id);
            insertStockMovement.run(
              item.product_id, item.variant_id, item.product_name, item.size, item.color,
              'Sale', -item.quantity, prevStock, newStock, 'Sale', saleId, invNum
            );
          }
        }

        // Customer ledger
        if (customerId) {
          const prevBalance = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId);
          const balance = (prevBalance?.balance || 0) + item.total_amount;
          db.prepare(`INSERT INTO customer_ledger (customer_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(customerId, dateStr, 'Sale', `Invoice ${invNum}`, 'Sale', saleId, invNum, item.total_amount, 0, balance);
        }
      });
    }
  }

  // Update invoice counter
  db.prepare("UPDATE shop_settings SET value = ? WHERE key = 'invoice_counter'").run(String(invoiceCounter));

  // Sample expenses
  const expenseCategories = ['Rent', 'Electricity', 'Salary', 'Transport', 'Packaging', 'Marketing'];
  const insertExpense = db.prepare('INSERT INTO expenses (category, amount, date, payment_method, description, created_by) VALUES (?, ?, ?, ?, ?, ?)');

  for (let d = 30; d >= 0; d--) {
    const expDate = new Date(today);
    expDate.setDate(today.getDate() - d);
    const dateStr = expDate.toISOString().split('T')[0];

    if (Math.random() > 0.6) {
      const cat = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      const amounts = { Rent: 15000, Electricity: 2000, Salary: 12000, Transport: 500, Packaging: 800, Marketing: 1500 };
      insertExpense.run(cat, amounts[cat] + Math.floor(Math.random() * 200), dateStr, 'Cash', `${cat} expense`, 1);
    }
  }

  // Catalogue settings
  const catalogueSettings = [
    ['show_hero', 'true'],
    ['hero_tagline', 'Premium Fashion for Every Occasion'],
    ['show_new_arrivals', 'true'],
    ['show_featured', 'true'],
    ['show_best_sellers', 'true'],
    ['banner_text', 'New Collection Arrived! Visit us at Dhobwal Bazzar'],
  ];
  const insertCatSetting = db.prepare('INSERT OR IGNORE INTO catalogue_settings (key, value) VALUES (?, ?)');
  catalogueSettings.forEach(([k, v]) => insertCatSetting.run(k, v));

  console.log('✅ Database seeded successfully');
}

module.exports = { seedDatabase };
