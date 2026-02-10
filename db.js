// Database Configuration using Dexie.js
// This file initializes the IndexedDB database for Sillara-POS

// Initialize Dexie database
const db = new Dexie("SillaraDB");

// Define database schema
db.version(1).stores({
  products: "++id, name, category, type, price, stock, minStock",
  sales: "++id, date, totalAmount, items",
});

// Database helper functions
const DB = {
  // Product operations
  products: {
    async getAll() {
      return await db.products.toArray();
    },

    async getById(id) {
      return await db.products.get(id);
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
          p.category.toLowerCase().includes(lowerQuery),
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

  // Utility operations
  async exportAll() {
    const products = await db.products.toArray();
    const sales = await db.sales.toArray();

    return {
      products,
      sales,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };
  },

  async importAll(data) {
    try {
      // Clear existing data
      await db.products.clear();
      await db.sales.clear();

      // Import products
      if (data.products && data.products.length > 0) {
        await db.products.bulkAdd(data.products);
      }

      // Import sales
      if (data.sales && data.sales.length > 0) {
        await db.sales.bulkAdd(data.sales);
      }

      return true;
    } catch (error) {
      console.error("Import error:", error);
      throw error;
    }
  },

  async clearAll() {
    await db.products.clear();
    await db.sales.clear();
  },

  async loadSampleData() {
    const sampleProducts = [
      // Grocery Items
      {
        name: "Rice - සුදු හාල්",
        category: "Grocery",
        type: "weight",
        price: 180, // per kg
        stock: 50,
        minStock: 10,
      },
      {
        name: "Sugar - සීනි",
        category: "Grocery",
        type: "weight",
        price: 200, // per kg
        stock: 25,
        minStock: 5,
      },
      {
        name: "Dhal - පරිප්පු",
        category: "Grocery",
        type: "weight",
        price: 220, // per kg
        stock: 20,
        minStock: 5,
      },
      {
        name: "Red Onions - රතු ළූණු",
        category: "Vegetables",
        type: "weight",
        price: 300, // per kg
        stock: 15,
        minStock: 3,
      },
      {
        name: "Potatoes - අල",
        category: "Vegetables",
        type: "weight",
        price: 150, // per kg
        stock: 30,
        minStock: 5,
      },

      // Biscuits
      {
        name: "Maliban Cream Cracker",
        category: "Biscuits",
        type: "unit",
        price: 180,
        stock: 50,
        minStock: 10,
      },
      {
        name: "Munchee Super Cream",
        category: "Biscuits",
        type: "unit",
        price: 200,
        stock: 45,
        minStock: 10,
      },
      {
        name: "Maliban Chocolate Puff",
        category: "Biscuits",
        type: "unit",
        price: 220,
        stock: 40,
        minStock: 10,
      },
      {
        name: "Munchee Lemon Puff",
        category: "Biscuits",
        type: "unit",
        price: 210,
        stock: 35,
        minStock: 10,
      },

      // Household Items
      {
        name: "Sunlight Soap",
        category: "Household",
        type: "unit",
        price: 85,
        stock: 60,
        minStock: 15,
      },
      {
        name: "Baby Soap",
        category: "Household",
        type: "unit",
        price: 95,
        stock: 40,
        minStock: 10,
      },
      {
        name: "Plastic Basin - බේසම",
        category: "Household",
        type: "unit",
        price: 350,
        stock: 20,
        minStock: 5,
      },
      {
        name: "Coconut Broom - කොකු මුට්ටි",
        category: "Household",
        type: "unit",
        price: 180,
        stock: 15,
        minStock: 5,
      },

      // More Vegetables
      {
        name: "Tomatoes - තක්කාලි",
        category: "Vegetables",
        type: "weight",
        price: 280,
        stock: 12,
        minStock: 3,
      },
      {
        name: "Carrots - කැරට්",
        category: "Vegetables",
        type: "weight",
        price: 200,
        stock: 10,
        minStock: 3,
      },
      {
        name: "Green Chilies - මිරිස්",
        category: "Vegetables",
        type: "weight",
        price: 350,
        stock: 8,
        minStock: 2,
      },
      {
        name: "Cabbage - ගෝවා",
        category: "Vegetables",
        type: "unit",
        price: 120,
        stock: 20,
        minStock: 5,
      },

      // More Grocery
      {
        name: "Tea Leaves - තේ කොළ",
        category: "Grocery",
        type: "weight",
        price: 800, // per kg
        stock: 5,
        minStock: 2,
      },
      {
        name: "Salt - ලුණු",
        category: "Grocery",
        type: "weight",
        price: 60, // per kg
        stock: 30,
        minStock: 5,
      },
      {
        name: "Milk Powder - කිරිපිටි",
        category: "Grocery",
        type: "unit",
        price: 950,
        stock: 25,
        minStock: 5,
      },
    ];

    await db.products.bulkAdd(sampleProducts);

    // Add some sample sales
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sampleSales = [
      {
        date: today,
        totalAmount: 1250.5,
        items: [
          { name: "Rice - සුදු හාල්", quantity: 5, price: 180, total: 900 },
          { name: "Sugar - සීනි", quantity: 1.5, price: 200, total: 300 },
          { name: "Sunlight Soap", quantity: 1, price: 85, total: 85 },
        ],
      },
      {
        date: today,
        totalAmount: 875,
        items: [
          {
            name: "Maliban Cream Cracker",
            quantity: 3,
            price: 180,
            total: 540,
          },
          { name: "Baby Soap", quantity: 2, price: 95, total: 190 },
          { name: "Salt - ලුණු", quantity: 2, price: 60, total: 120 },
        ],
      },
      {
        date: yesterday,
        totalAmount: 1560,
        items: [
          { name: "Rice - සුදු හාල්", quantity: 3, price: 180, total: 540 },
          { name: "Dhal - පරිප්පු", quantity: 2, price: 220, total: 440 },
          { name: "Potatoes - අල", quantity: 2, price: 150, total: 300 },
          {
            name: "Red Onions - රතු ළූණු",
            quantity: 1,
            price: 300,
            total: 300,
          },
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
