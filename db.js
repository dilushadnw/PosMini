// Database Configuration using Dexie.js
// This file initializes the IndexedDB database for Sillara-POS

// Initialize Dexie database
const db = new Dexie("SillaraDB");

// Define database schema
// Define database schema
db.version(6).stores({
  products: "++id, name, barcode, category, type, price, buyingPrice, stock, minStock",
  sales: "++id, date, totalAmount, items",
  purchases: "++id, date, supplier, totalCost, items",
  expenses: "++id, date, description, amount, category",
  shop_settings: "id, name, phone, address, info",
  categories: "++id, &name" // Uniqueness constraint on category name
});

// Database helper functions
const DB = {
  // Category operations
  categories: {
    async getAll() {
      return await db.categories.toArray();
    },
    async add(name) {
      try {
        return await db.categories.add({ name });
      } catch (e) {
        // Ignore unique constraint errors
        return null;
      }
    },
    async delete(id) {
      return await db.categories.delete(id);
    },
    async update(id, name) {
      return await db.categories.update(id, { name });
    }
  },
  // Product operations
  products: {
    async getAll() {
      return await db.products.toArray();
    },

    async getById(id) {
      return await db.products.get(id);
    },
    
    async getByBarcode(barcode) {
      if (!barcode) return null;
      const items = await db.products.where('barcode').equals(barcode).toArray();
      // FIFO: Pick oldest ID that has stock, otherwise pick oldest ID
      return items.find(p => p.stock > 0) || items[0];
    },

    async getByBarcodeAndPrice(barcode, price) {
      return await db.products.where({ barcode, price }).first();
    },

    async add(product) {
      return await db.products.add(product);
    },

    async update(id, changes) {
      return await db.products.update(id, changes);
    },

    async delete(id) {
      return await db.products.delete(id);
    },

    async search(query) {
      const products = await db.products.toArray();
      const lowerQuery = query.toLowerCase();
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery) ||
          (p.barcode && p.barcode.toLowerCase().includes(lowerQuery))
      );
    },

    async filterByCategory(category) {
      if (category === "all") {
        return await db.products.toArray();
      }
      return await db.products.where("category").equals(category).toArray();
    },

    async getLowStock() {
      const products = await db.products.toArray();
      return products.filter((p) => p.stock <= (p.minStock || 5));
    },

    async count() {
      return await db.products.count();
    },
  },

  // Sales operations
  sales: {
    async getAll() {
      return await db.sales.toArray();
    },

    async getById(id) {
      return await db.sales.get(id);
    },

    async add(sale) {
      sale.date = new Date();
      return await db.sales.add(sale);
    },

    async getToday() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sales = await db.sales.toArray();
      return sales.filter((s) => {
        const saleDate = new Date(s.date);
        return saleDate >= today && saleDate < tomorrow;
      });
    },

    async getTodayTotal() {
      const todaySales = await this.getToday();
      return todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    },

    async getTodayCount() {
      const todaySales = await this.getToday();
      return todaySales.length;
    },

    async getByDateRange(fromDate, toDate) {
      const sales = await db.sales.toArray();
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      return sales.filter((s) => {
        const saleDate = new Date(s.date);
        return saleDate >= from && saleDate <= to;
      });
    },

    async count() {
      return await db.sales.count();
    },
  },

  // Purchases operations
  purchases: {
    async add(purchase) {
      if (!purchase.date) purchase.date = new Date();
      return await db.purchases.add(purchase);
    },
    async getAll() {
      return await db.purchases.toArray();
    },
    async getByDateRange(fromDate, toDate) {
      const all = await db.purchases.toArray();
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      return all.filter((p) => {
        const d = new Date(p.date);
        return d >= from && d <= to;
      });
    }
  },

  // Expenses operations
  expenses: {
      async add(expense) {
        if (!expense.date) expense.date = new Date();
        return await db.expenses.add(expense);
      },
      async getAll() {
        return await db.expenses.toArray();
      },
      async getByDateRange(fromDate, toDate) {
        const all = await db.expenses.toArray();
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
  
        return all.filter((e) => {
          const d = new Date(e.date);
          return d >= from && d <= to;
        });
      }
  },

  // Shop Settings operations
  shop_settings: {
    async get() {
      // Shop settings uses a single record with id = 1
      const settings = await db.shop_settings.get(1);
      return settings || {
        id: 1,
        name: "Sillara Badu Kadaya",
        phone: "",
        address: "",
        info: ""
      };
    },
    
    async save(settings) {
      settings.id = 1; // Always use id 1 for shop settings
      await db.shop_settings.put(settings);
      return settings;
    }
  },

  // Utility operations
  async exportAll() {
    const products = await db.products.toArray();
    const sales = await db.sales.toArray();
    const purchases = await db.purchases.toArray();
    const expenses = await db.expenses.toArray();
    const categories = await db.categories.toArray();
    const shopSettings = await db.shop_settings.get(1);

    return {
      products,
      sales,
      purchases,
      expenses,
      categories,
      shopSettings,
      exportDate: new Date().toISOString(),
      version: 6,
    };
  },

  async importAll(data) {
    try {
      await db.transaction(
        "rw",
        db.products,
        db.sales,
        db.purchases,
        db.expenses,
        db.categories,
        db.shop_settings,
        async () => {
          await db.products.clear();
          await db.sales.clear();
          await db.purchases.clear();
          await db.expenses.clear();
          await db.categories.clear();
          await db.shop_settings.clear();

          if (data.products) await db.products.bulkAdd(data.products);
          if (data.sales) await db.sales.bulkAdd(data.sales);
          if (data.purchases) await db.purchases.bulkAdd(data.purchases);
          if (data.expenses) await db.expenses.bulkAdd(data.expenses);
          if (data.categories) await db.categories.bulkAdd(data.categories);
          if (data.shopSettings) await db.shop_settings.put(data.shopSettings);
        }
      );
      return true;
    } catch (error) {
      console.error("Import error:", error);
      throw error;
    }
  },

  async clearAll() {
    await db.products.clear();
    await db.sales.clear();
    await db.purchases.clear();
    await db.expenses.clear();
    await db.categories.clear();
    // Don't clear shop settings when clearing data
  },

  async loadSampleData() {
    await db.transaction("rw", db.products, db.sales, db.purchases, db.expenses, db.categories, async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.purchases.clear();
      await db.expenses.clear();
      await db.categories.clear();
    });

    const sampleCategories = [
      { name: "Grocery" },
      { name: "Vegetables" },
      { name: "Biscuits" },
      { name: "Household" },
      { name: "Other" }
    ];
    await db.categories.bulkAdd(sampleCategories);

    const sampleProducts = [
      {
        barcode: "100001",
        name: "Rice - සුදු හාල්",
        category: "Grocery",
        type: "weight",
        price: 240,
        buyingPrice: 205,
        stock: 38,
        minStock: 10,
      },
      {
        barcode: "100002",
        name: "Sugar - සීනි",
        category: "Grocery",
        type: "weight",
        price: 265,
        buyingPrice: 225,
        stock: 22,
        minStock: 5,
      },
      {
        barcode: "100003",
        name: "Dhal - පරිප්පු",
        category: "Grocery",
        type: "weight",
        price: 310,
        buyingPrice: 268,
        stock: 17,
        minStock: 5,
      },
      {
        barcode: "200001",
        name: "Tomatoes - තක්කාලි",
        category: "Vegetables",
        type: "weight",
        price: 260,
        buyingPrice: 210,
        stock: 11,
        minStock: 3,
      },
      {
        barcode: "300001",
        name: "Maliban Cream Cracker",
        category: "Biscuits",
        type: "unit",
        price: 230,
        buyingPrice: 188,
        stock: 44,
        minStock: 10,
      },
      {
        barcode: "300002",
        name: "Munchee Lemon Puff",
        category: "Biscuits",
        type: "unit",
        price: 250,
        buyingPrice: 205,
        stock: 36,
        minStock: 10,
      },
      {
        barcode: "400001",
        name: "Sunlight Soap",
        category: "Household",
        type: "unit",
        price: 120,
        buyingPrice: 90,
        stock: 58,
        minStock: 15,
      },
      {
        barcode: "400002",
        name: "Plastic Basin - බේසම",
        category: "Household",
        type: "unit",
        price: 480,
        buyingPrice: 390,
        stock: 16,
        minStock: 5,
      },
    ];

    await db.products.bulkAdd(sampleProducts);

    const makeDate = (daysAgo, hour) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hour, 15, 0, 0);
      return d;
    };

    const samplePurchases = [
      {
        supplier: "Lanka Wholesale",
        date: makeDate(6, 9),
        totalCost: 15610,
        items: [
          { barcode: "100001", name: "Rice - සුදු හාල්", quantity: 30, type: "weight", buyingPrice: 205, sellingPrice: 240, total: 6150 },
          { barcode: "100002", name: "Sugar - සීනි", quantity: 20, type: "weight", buyingPrice: 225, sellingPrice: 265, total: 4500 },
          { barcode: "300001", name: "Maliban Cream Cracker", quantity: 20, type: "unit", buyingPrice: 188, sellingPrice: 230, total: 3760 },
          { barcode: "400001", name: "Sunlight Soap", quantity: 20, type: "unit", buyingPrice: 90, sellingPrice: 120, total: 1800 },
        ],
      },
      {
        supplier: "City Distributors",
        date: makeDate(2, 11),
        totalCost: 9830,
        items: [
          { barcode: "100003", name: "Dhal - පරිප්පු", quantity: 15, type: "weight", buyingPrice: 268, sellingPrice: 310, total: 4020 },
          { barcode: "200001", name: "Tomatoes - තක්කාලි", quantity: 12, type: "weight", buyingPrice: 210, sellingPrice: 260, total: 2520 },
          { barcode: "300002", name: "Munchee Lemon Puff", quantity: 18, type: "unit", buyingPrice: 205, sellingPrice: 250, total: 3690 },
        ],
      },
    ];

    await db.purchases.bulkAdd(samplePurchases);

    const sampleSales = [
      {
        date: makeDate(5, 13),
        totalAmount: 1690,
        items: [
          { barcode: "100001", name: "Rice - සුදු හාල්", quantity: 3, price: 240, buyingPrice: 205, total: 720 },
          { barcode: "300001", name: "Maliban Cream Cracker", quantity: 2, price: 230, buyingPrice: 188, total: 460 },
          { barcode: "400001", name: "Sunlight Soap", quantity: 3, price: 120, buyingPrice: 90, total: 360 },
          { barcode: "200001", name: "Tomatoes - තක්කාලි", quantity: 0.5, price: 260, buyingPrice: 210, total: 130 },
        ],
      },
      {
        date: makeDate(3, 16),
        totalAmount: 1995,
        items: [
          { barcode: "100002", name: "Sugar - සීනි", quantity: 2, price: 265, buyingPrice: 225, total: 530 },
          { barcode: "100003", name: "Dhal - පරිප්පු", quantity: 1.5, price: 310, buyingPrice: 268, total: 465 },
          { barcode: "300002", name: "Munchee Lemon Puff", quantity: 3, price: 250, buyingPrice: 205, total: 750 },
          { barcode: "400001", name: "Sunlight Soap", quantity: 2, price: 120, buyingPrice: 90, total: 240 },
        ],
      },
      {
        date: makeDate(1, 19),
        totalAmount: 2159,
        items: [
          { barcode: "100001", name: "Rice - සුදු හාල්", quantity: 2.5, price: 240, buyingPrice: 205, total: 600 },
          { barcode: "300001", name: "Maliban Cream Cracker", quantity: 4, price: 230, buyingPrice: 188, total: 920 },
          { barcode: "400002", name: "Plastic Basin - බේසම", quantity: 1, price: 480, buyingPrice: 390, total: 480 },
          { barcode: "100002", name: "Sugar - සීනි", quantity: 0.6, price: 265, buyingPrice: 225, total: 159 },
        ],
      },
    ];

    await db.sales.bulkAdd(sampleSales);
  },
};

// Initialize database
db.open()
  .then(() => {
    console.log("Sillara-POS Database initialized successfully!");
  })
  .catch((err) => {
    console.error("Failed to open database:", err);
  });

// Export for use in other files
window.DB = DB;
