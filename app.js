// Main Application Logic for Sillara-POS
// Global variables
let currentPage = 'dashboard';
let cart = [];
let products = [];
let currentFilter = 'all';
let purchaseCart = [];

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    showPage('dashboard');
    
    // Set default dates for reports
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-from-date').value = today;
    document.getElementById('report-to-date').value = today;
});

// Initialize application
async function initApp() {
    await loadProducts();
    await loadCategories();
    await updateDashboard();
    console.log('Sillara-POS Application initialized!');
}

function checkAdminPassword() {
    const password = prompt('Please enter Admin Password (සැකසුම් වෙනස් කිරීමට මුරපදය ඇතුළත් කරන්න):');
    if (password === '1234') {
        return true;
    } else {
        alert('Invalid Password! (වැරදි මුරපදයක්!)');
        return false;
    }
}

async function loadCategories() {
    try {
        // Fetch from categories store
        let categories = await DB.categories.getAll();
        
        // If empty (e.g., first run), try to seed from existing products
        if (categories.length === 0) {
            const allProducts = await DB.products.getAll();
            const uniqueCats = [...new Set(allProducts.map(p => p.category))].filter(Boolean);
            for (const cat of uniqueCats) {
                await DB.categories.add(cat);
            }
            categories = await DB.categories.getAll();
        }

        // Populate selects
        const selects = ['product-category', 'purchase-category'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const currentVal = select.value;
                select.innerHTML = '<option value="">Select Category</option>' + 
                    categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
                if (currentVal) select.value = currentVal;
            }
        });

        const list = document.getElementById('category-list');
        if (list) {
            list.innerHTML = categories.map(c => `<option value="${c.name}">`).join('');
        }

        // Populate settings list
        const settingsList = document.getElementById('settings-category-list');
        if (settingsList) {
            settingsList.innerHTML = categories.map(c => `
                <div class="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm border border-gray-200">
                    <span class="mr-2">${c.name}</span>
                    <button onclick="deleteCategory(${c.id})" class="text-red-500 hover:text-red-700">
                        <i class="ri-close-circle-fill"></i>
                    </button>
                </div>
            `).join('');
            
            if (categories.length === 0) {
                settingsList.innerHTML = '<p class="text-sm text-gray-400">No categories added yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function addNewCategory() {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim();
    if (!name) return;

    if (!checkAdminPassword()) return;
    
    try {
        const id = await DB.categories.add(name);
        input.value = '';
        await loadCategories();
        
        // Auto-select the new category in forms
        const selects = ['product-category', 'purchase-category'];
        selects.forEach(secId => {
            const select = document.getElementById(secId);
            if (select) select.value = name;
        });
    } catch (e) {
        alert('Category might already exist');
    }
}

async function deleteCategory(id) {
    if (!checkAdminPassword()) return;
    if (!confirm('Are you sure you want to delete this category? It will not affect existing products.')) return;
    
    try {
        await DB.categories.delete(id);
        await loadCategories();
    } catch (error) {
        console.error('Error deleting category:', error);
    }
}

// Page Navigation
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.remove('hidden');
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const navBtn = document.getElementById(`nav-${pageName}`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    currentPage = pageName;
    
    // Load page-specific data
    if (pageName === 'dashboard') {
        updateDashboard();
    } else if (pageName === 'pos') {
        displayProducts();
        setTimeout(() => {
            const search = document.getElementById('product-search');
            if (search) search.focus();
        }, 100);
    } else if (pageName === 'inventory') {
        displayInventory();
    } else if (pageName === 'reports') {
        generateReport();
    } else if (pageName === 'settings') {
        loadShopSettings();
        loadCategories();
    }
}

// Toggle mobile menu
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

// Load products from database
async function loadProducts() {
    products = await DB.products.getAll();
}

// Dashboard Functions
async function updateDashboard() {
    // Update stats
    const todaySales = await DB.sales.getTodayTotal();
    const todayTransactions = await DB.sales.getTodayCount();
    const totalProducts = await DB.products.count();
    const lowStockItems = await DB.products.getLowStock();
    
    document.getElementById('today-sales').textContent = todaySales.toFixed(2);
    document.getElementById('today-transactions').textContent = todayTransactions;
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('low-stock-count').textContent = lowStockItems.length;
    
    // Display low stock items
    displayLowStockAlerts(lowStockItems);
}

// Display low stock alerts
function displayLowStockAlerts(items) {
    const container = document.getElementById('low-stock-list');
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="ri-checkbox-circle-line text-5xl mb-2"></i>
                <p class="font-sinhala">තොග හොඳයි</p>
                <p class="text-sm">All stocks are healthy</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = items.map(item => `
        <div class="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl pulse-animation">
            <div class="flex-1">
                <p class="font-semibold text-gray-900">${item.name}</p>
                <p class="text-sm text-gray-600">
                    Stock: ${item.stock} ${item.type === 'weight' ? 'kg' : 'units'}
                    <span class="text-red-600 ml-2">⚠ Low!</span>
                </p>
            </div>
            <button onclick="showEditProductModal(${item.id})" class="bg-primary-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-primary-600">
                <i class="ri-add-line"></i> Add Stock
            </button>
        </div>
    `).join('');
}

// POS Functions
async function displayProducts(searchQuery = '') {
    products = searchQuery ? 
        await DB.products.search(searchQuery) : 
        await DB.products.filterByCategory(currentFilter);
    
    const grid = document.getElementById('products-grid');
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-400">
                <i class="ri-inbox-line text-6xl mb-4"></i>
                <p class="font-sinhala">භාණ්ඩ නැත</p>
                <p>No products found</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = products.map(product => {
        const isOutOfStock = product.stock <= 0;
        const isLowStock = product.stock <= (product.minStock || 5) && product.stock > 0;
        
        return `
            <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" 
                 onclick="${isOutOfStock ? '' : `showQuantityModal(${product.id})`}">
                <div class="text-center">
                    <div class="bg-gradient-to-br from-primary-100 to-primary-200 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3">
                        <i class="ri-shopping-bag-line text-3xl text-primary-700"></i>
                    </div>
                    
                    <h4 class="font-semibold text-gray-900 mb-1 text-sm line-clamp-2">${product.name}</h4>
                    <p class="text-xs text-gray-500 mb-2">${product.category}</p>
                    
                    <div class="mt-2">
                        <p class="text-lg font-bold text-primary-600">Rs. ${product.price.toFixed(2)}</p>
                        <p class="text-xs text-gray-500">per ${product.type === 'weight' ? 'kg' : 'unit'}</p>
                    </div>
                    
                    <div class="mt-2">
                        ${isOutOfStock ? 
                            '<span class="badge badge-danger text-xs">Out of Stock</span>' :
                            isLowStock ?
                            `<span class="badge badge-warning text-xs">Low: ${product.stock}</span>` :
                            `<span class="badge badge-success text-xs">Stock: ${product.stock}</span>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Search products
function searchProducts(query) {
    displayProducts(query);
}

// Search products with Barcode support
async function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const query = event.target.value.trim();
        
        if (!query) return;

        // Try to find by exact barcode match first
        const productByBarcode = await DB.products.getByBarcode(query);
        
        if (productByBarcode) {
            // Found by barcode! Add to cart immediately
            if (productByBarcode.stock <= 0) {
                alert(`Out of Stock: ${productByBarcode.name}`);
                event.target.value = '';
                return;
            }
            
            // If unit type, add 1. If weight, show modal?
            // For speed, let's just add 1 unit/kg and let user edit quantity if needed
            // Or better: show quantity modal for weight, auto-add for unit
            
            if (productByBarcode.type === 'weight') {
                showQuantityModal(productByBarcode.id);
            } else {
                addToCart(productByBarcode, 1);
                // Visual feedback
                const notification = document.createElement('div');
                notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-500 z-50 flex items-center gap-2';
                notification.innerHTML = `<i class="ri-check-line text-xl"></i> Added ${productByBarcode.name}`;
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.style.opacity = '0';
                    setTimeout(() => notification.remove(), 500);
                }, 2000);
            }
            
            event.target.value = ''; // Clear search
            displayProducts(''); // Reset grid
        }
    }
}

// Add Item Helper
function addToCart(product, quantity) {
    // Check if product already in cart
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
        if (existingItem.quantity + quantity > product.stock) {
            alert(`Not enough stock! Available: ${product.stock}`);
            return;
        }
        existingItem.quantity += quantity;
        existingItem.total = existingItem.quantity * existingItem.price;
    } else {
        if (quantity > product.stock) {
            alert(`Not enough stock! Available: ${product.stock}`);
            return;
        }
        cart.push({
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            buyingPrice: product.buyingPrice || 0,
            quantity: quantity,
            type: product.type,
            total: product.price * quantity
        });
    }
    updateCart();
}

// Filter by category
function filterByCategory(category) {
    currentFilter = category;
    
    // Update active button
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.category-filter-btn').classList.add('active');
    
    displayProducts();
}

// Quantity Modal
function showQuantityModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('qty-product-id').value = product.id;
    document.getElementById('qty-product-name').textContent = product.name;
    document.getElementById('qty-product-type').textContent = 
        `Price: Rs. ${product.price} per ${product.type === 'weight' ? 'kg' : 'unit'}`;
    
    const label = product.type === 'weight' ? 'Weight (kg)' : 'Quantity';
    document.getElementById('qty-label').textContent = label;
    
    document.getElementById('quantity-input').value = '';
    document.getElementById('quantity-modal').classList.remove('hidden');
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('quantity-input').focus();
    }, 100);
}

function closeQuantityModal() {
    document.getElementById('quantity-modal').classList.add('hidden');
}

// Add to cart with quantity
function addToCartWithQuantity(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('qty-product-id').value);
    const quantity = parseFloat(document.getElementById('quantity-input').value);
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    addToCart(product, quantity);
    closeQuantityModal();
    
    // If it was from barcode scan (search box might still have text?)
    // Actually, usually quantity modal is from click.
    // If from barcode, we might want to clear search.
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
}

// Update cart display
function updateCart() {
    const cartContainer = document.getElementById('cart-items');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="text-center text-gray-400 py-12">
                <i class="ri-shopping-cart-line text-6xl mb-4"></i>
                <p class="font-sinhala">බිල්පත හිස්</p>
                <p class="text-sm">Add items to cart</p>
            </div>
        `;
        document.getElementById('cart-subtotal').textContent = '0.00';
        document.getElementById('cart-total').textContent = '0.00';
        document.getElementById('cash-tendered').value = '';
        document.getElementById('cart-balance').textContent = '0.00';
        return;
    }
    
    cartContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="flex-1">
                <p class="font-semibold text-gray-900 text-sm">${item.name}</p>
                <p class="text-xs text-gray-600">
                    ${item.quantity} ${item.type === 'weight' ? 'kg' : 'units'} × Rs. ${item.price.toFixed(2)}
                </p>
            </div>
            <div class="text-right">
                <p class="font-bold text-gray-900">Rs. ${item.total.toFixed(2)}</p>
                <button onclick="removeFromCart(${index})" class="cart-item-remove">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + item.total, 0);
    document.getElementById('cart-subtotal').textContent = total.toFixed(2);
    document.getElementById('cart-total').textContent = total.toFixed(2);
    calculateBalance();
}

function calculateBalance() {
    const total = parseFloat(document.getElementById('cart-total').textContent) || 0;
    const tendered = parseFloat(document.getElementById('cash-tendered').value) || 0;
    const balance = tendered > 0 ? tendered - total : 0;
    
    const balanceEl = document.getElementById('cart-balance');
    if (balanceEl) {
        balanceEl.textContent = balance.toFixed(2);
        // Highlight in red if tendered is less than total
        if (tendered > 0 && tendered < total) {
            balanceEl.parentElement.classList.add('text-red-500');
            balanceEl.parentElement.classList.remove('text-accent-600');
        } else {
            balanceEl.parentElement.classList.remove('text-red-500');
            balanceEl.parentElement.classList.add('text-accent-600');
        }
    }
}

// Remove from cart
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

// Clear cart
function clearCart() {
    if (cart.length === 0) return;
    
    if (confirm('Clear all items from cart?')) {
        cart = [];
        updateCart();
    }
}

// Complete sale
async function completeSale() {
    if (cart.length === 0) {
        alert('Cart is empty! Add items first.');
        return;
    }
    
    try {
        // Calculate total
        const totalAmount = cart.reduce((sum, item) => sum + item.total, 0);
        const tendered = parseFloat(document.getElementById('cash-tendered').value) || 0;
        const balance = tendered > 0 ? tendered - totalAmount : 0;

        // Create sale record
        const sale = {
            totalAmount,
            cashTendered: tendered,
            balance: balance,
            items: cart.map(item => ({
                barcode: item.barcode || '',
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                buyingPrice: item.buyingPrice || 0,
                total: item.total
            }))
        };
        
        // Save to database
        const saleId = await DB.sales.add(sale);
        
        // Update stock
        for (const item of cart) {
            const product = await DB.products.getById(item.productId);
            await DB.products.update(item.productId, {
                stock: product.stock - item.quantity
            });
        }
        
        // Show receipt
        showReceipt(saleId, sale);
        
        // Clear cart
        cart = [];
        updateCart();
        
        // Reload products
        await loadProducts();
        await updateDashboard();
        displayProducts();
        
    } catch (error) {
        console.error('Sale error:', error);
        alert('Error completing sale. (දෝෂයක් සිදුවිය!)');
    }
}

// Show receipt
async function showReceipt(saleId, sale) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB');
    
    // Get shop settings
    const shopSettings = await DB.shop_settings.get();
    
    const receiptContent = `
        <div class="receipt-header">
            <div class="receipt-title">${shopSettings.name}</div>
            ${shopSettings.phone ? `<div class="receipt-info">Tel: ${shopSettings.phone}</div>` : ''}
            ${shopSettings.address ? `<div class="receipt-info">${shopSettings.address}</div>` : ''}
            ${shopSettings.info ? `<div class="receipt-info" style="font-size: 0.75rem;">${shopSettings.info}</div>` : ''}
            <div class="receipt-info" style="margin-top: 0.5rem; border-top: 1px dashed #d1d5db; padding-top: 0.5rem;">
                Bill #: ${saleId}<br>
                Date: ${dateStr}<br>
                Time: ${timeStr}
            </div>
        </div>
        
        <div class="receipt-items">
            <table style="width: 100%; font-size: 0.875rem;">
                <thead>
                    <tr style="border-bottom: 1px dashed #d1d5db;">
                        <th style="text-align: left; padding-bottom: 0.5rem;">Item</th>
                        <th style="text-align: right; padding-bottom: 0.5rem;">Qty</th>
                        <th style="text-align: right; padding-bottom: 0.5rem;">Price</th>
                        <th style="text-align: right; padding-bottom: 0.5rem;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${sale.items.map(item => `
                        <tr>
                            <td style="padding: 0.25rem 0;">${item.name}</td>
                            <td style="text-align: right;">${item.quantity}</td>
                            <td style="text-align: right;">${item.price.toFixed(2)}</td>
                            <td style="text-align: right;">${item.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="receipt-total" style="padding-bottom: 0;">
            <span>TOTAL:</span>
            <span>Rs. ${sale.totalAmount.toFixed(2)}</span>
        </div>

        ${sale.cashTendered > 0 ? `
        <div class="receipt-total" style="padding: 0.25rem 0; border-top: none; font-size: 0.9rem;">
            <span>Cash Tendered:</span>
            <span>Rs. ${sale.cashTendered.toFixed(2)}</span>
        </div>
        <div class="receipt-total" style="padding-top: 0; border-top: none; font-size: 0.9rem;">
            <span>Balance:</span>
            <span>Rs. ${sale.balance.toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="receipt-footer">
            Thank you!<br>
            ස්තූතියි!<br>
            <br>
            Powered by Sillara-POS DNW
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptContent;
    document.getElementById('receipt-modal').classList.remove('hidden');
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
}
async function displayInventory() {
    const products = await DB.products.getAll();
    const tbody = document.getElementById('inventory-table-body');
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-12 text-gray-400">
                    <i class="ri-inbox-line text-6xl mb-4 block"></i>
                    <p class="font-sinhala">භාණ්ඩ නැත</p>
                    <p>No products in inventory</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        const isLowStock = product.stock <= (product.minStock || 5);
        const isOutOfStock = product.stock <= 0;
        
        let statusBadge;
        if (isOutOfStock) {
            statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
        } else if (isLowStock) {
            statusBadge = '<span class="badge badge-warning">Low Stock</span>';
        } else {
            statusBadge = '<span class="badge badge-success">In Stock</span>';
        }
        
        return `
            <tr>
                <td class="font-semibold text-gray-900">
                    ${product.name}
                    ${product.barcode ? `<br><span class="text-xs text-gray-400 font-mono">${product.barcode}</span>` : ''}
                </td>
                <td><span class="text-sm text-gray-600">${product.category}</span></td>
                <td><span class="text-sm text-gray-600 capitalize">${product.type}</span></td>
                <td class="font-semibold text-primary-600">Rs. ${product.price.toFixed(2)}</td>
                <td class="font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}">
                    ${product.stock} ${product.type === 'weight' ? 'kg' : 'units'}
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="flex gap-2">
                        <button onclick="showEditProductModal(${product.id})" 
                                class="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-all">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button onclick="deleteProduct(${product.id})" 
                                class="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-all">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Product Modal Functions
function showAddProductModal() {
    document.getElementById('modal-title').textContent = 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-modal').classList.remove('hidden');
}

async function showEditProductModal(productId) {
    const product = await DB.products.getById(productId);
    if (!product) return;
    
    document.getElementById('modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-barcode').value = product.barcode || '';
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-type').value = product.type;
    document.getElementById('product-buying-price').value = product.buyingPrice || '';
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-min-stock').value = product.minStock || 5;
    
    document.getElementById('product-modal').classList.remove('hidden');
    // Focus on barcode input for quick editing
    setTimeout(() => document.getElementById('product-barcode').focus(), 100);
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// Save product
async function saveProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-id').value;
    const buyingPriceVal = document.getElementById('product-buying-price').value;

    const productData = {
        name: document.getElementById('product-name').value,
        barcode: document.getElementById('product-barcode').value.trim(),
        category: document.getElementById('product-category').value,
        type: document.getElementById('product-type').value,
        buyingPrice: buyingPriceVal ? parseFloat(buyingPriceVal) : 0,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseFloat(document.getElementById('product-stock').value),
        minStock: parseFloat(document.getElementById('product-min-stock').value) || 5
    };
    
    try {
        if (productId) {
            // Update existing product
            await DB.products.update(parseInt(productId), productData);
        } else {
            // Add new product
            await DB.products.add(productData);
        }
        
        closeProductModal();
        await loadProducts();
        displayInventory();
        updateDashboard();
        
        alert(`Product ${productId ? 'updated' : 'added'} successfully!`);
    } catch (error) {
        console.error('Save product error:', error);
        alert('Error saving product. Please try again.');
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        await DB.products.delete(productId);
        await loadProducts();
        displayInventory();
        updateDashboard();
        alert('Product deleted successfully!');
    } catch (error) {
        console.error('Delete product error:', error);
        alert('Error deleting product. Please try again.');
    }
}

// Reports Functions
async function setReportRange(range) {
    const fromDateEl = document.getElementById('report-from-date');
    const toDateEl = document.getElementById('report-to-date');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let from = today;
    let to = today;
    
    if (range === 'all') {
        const [allSales, allPurchases, allExpenses] = await Promise.all([
            DB.sales.getAll(),
            DB.purchases.getAll(),
            DB.expenses.getAll()
        ]);

        const allDates = [
            ...allSales.map(s => s.date),
            ...allPurchases.map(p => p.date),
            ...allExpenses.map(e => e.date)
        ]
            .filter(Boolean)
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()));

        if (allDates.length > 0) {
            const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));
            from = earliestDate.toISOString().split('T')[0];
        }
    } else if (range === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        from = yesterday.toISOString().split('T')[0];
        to = from;
    } else if (range === 'thisMonth') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (range === 'lastMonth') {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (range === 'thisYear') {
        from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    
    fromDateEl.value = from;
    toDateEl.value = to;
    generateReport();
}

async function generateReport() {
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates');
        return;
    }
    
    // --- 1. SALES REPORT ---
    const sales = await DB.sales.getByDateRange(fromDate, toDate);
    
    // Stats
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const avgBill = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Profit Logic
    const totalCost = sales.reduce((sum, sale) => {
        const saleCost = sale.items.reduce((isum, item) => {
            const itemBuyingPrice = item.buyingPrice || 0;
            return isum + (itemBuyingPrice * item.quantity);
        }, 0);
        return sum + saleCost;
    }, 0);
    
    const totalProfit = totalSales - totalCost;
    const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    
    // Update Stats UI
    document.getElementById('report-total-sales').textContent = totalSales.toFixed(2);
    document.getElementById('report-total-profit').innerHTML = 
        `${totalProfit.toFixed(2)} <span class="text-sm font-normal opacity-80">(${margin.toFixed(1)}%)</span>`;
    document.getElementById('report-total-transactions').textContent = totalTransactions;
    document.getElementById('report-avg-bill').textContent = avgBill.toFixed(2);
    
    // Top Products Logic
    const productStats = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!productStats[item.name]) productStats[item.name] = { qty: 0, revenue: 0 };
            productStats[item.name].qty += item.quantity;
            productStats[item.name].revenue += item.total;
        });
    });
    
    const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
        
    const topProductsList = document.getElementById('report-top-products');
    if (topProducts.length === 0) {
        topProductsList.innerHTML = '<p class="text-gray-400 text-center py-4">No sales data found</p>';
    } else {
        topProductsList.innerHTML = topProducts.map((p, i) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full font-bold text-sm">${i+1}</span>
                    <span class="font-medium text-gray-700">${p.name}</span>
                </div>
                <div class="text-right">
                    <p class="font-bold text-gray-900">${p.qty} <span class="text-xs font-normal text-gray-500">sold</span></p>
                    <p class="text-xs text-gray-500">Rs. ${p.revenue.toFixed(2)}</p>
                </div>
            </div>
        `).join('');
    }

    // Sales Table
    const tbody = document.getElementById('sales-report-table-body');
    if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400"><i class="ri-file-list-line text-6xl mb-4 block"></i><p class="font-sinhala">විකුණුම් නැත</p><p>No sales found for selected period</p></td></tr>`;
    } else {
        tbody.innerHTML = sales.reverse().map(sale => {
            const date = new Date(sale.date);
            const dateStr = date.toLocaleDateString('en-GB');
            const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            return `
                <tr>
                    <td class="font-semibold text-primary-600">#${sale.id}</td>
                    <td><div>${dateStr}</div><div class="text-xs text-gray-500">${timeStr}</div></td>
                    <td><div class="text-sm text-gray-600">${sale.items.length} item${sale.items.length > 1 ? 's' : ''}</div></td>
                    <td class="font-bold text-gray-900">Rs. ${sale.totalAmount.toFixed(2)}</td>
                    <td><button onclick="viewSaleDetails(${sale.id})" class="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-all"><i class="ri-eye-line"></i> View</button></td>
                </tr>
            `;
        }).join('');
    }

    // --- 2. INCOME STATEMENT ---
    const expenses = await DB.expenses.getByDateRange(fromDate, toDate);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalProfit - totalExpenses;

    document.getElementById('is-revenue').textContent = totalSales.toFixed(2);
    document.getElementById('is-cogs').textContent = totalCost.toFixed(2);
    document.getElementById('is-gross-profit').textContent = totalProfit.toFixed(2);
    document.getElementById('is-expenses').textContent = totalExpenses.toFixed(2);
    document.getElementById('is-net-profit').textContent = netProfit.toFixed(2);

    // --- 3. PURCHASE HISTORY ---
    const purchases = await DB.purchases.getByDateRange(fromDate, toDate);
    const purchaseTbody = document.getElementById('purchase-history-body');
    if (purchases.length === 0) {
        purchaseTbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-400">No purchases found for this period</td></tr>';
    } else {
        const rows = [];
        purchases.reverse().forEach(p => {
            const d = new Date(p.date);
            const dateStr = d.toLocaleDateString();
            
            p.items.forEach(item => {
                const bPrice = item.buyingPrice || item.cost || 0;
                const sPrice = item.sellingPrice || 0;
                rows.push(`
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">${dateStr}</td>
                        <td class="px-6 py-4 text-xs text-gray-700 font-medium">${p.supplier}</td>
                        <td class="px-6 py-4 text-sm">
                            <div class="font-bold text-gray-900">${item.name}</div>
                            <div class="text-[10px] text-gray-500">${item.quantity} ${item.type === 'weight' ? 'kg' : 'pcs'}</div>
                        </td>
                        <td class="px-6 py-4 text-right text-sm font-semibold text-blue-600">Rs. ${bPrice.toFixed(2)}</td>
                        <td class="px-6 py-4 text-right text-sm font-semibold text-green-600">Rs. ${sPrice.toFixed(2)}</td>
                        <td class="px-6 py-4 text-right text-sm font-bold text-gray-900">Rs. ${(bPrice * item.quantity).toFixed(2)}</td>
                    </tr>
                `);
            });
        });
        purchaseTbody.innerHTML = rows.join('');
    }
}

async function exportSalesCSV() {
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates first');
        return;
    }
    
    const sales = await DB.sales.getByDateRange(fromDate, toDate);
    
    if (sales.length === 0) {
        alert('No sales found for the selected period');
        return;
    }
    
    let csv = "Date,Bill No,Barcode,Item Name,Quantity,Buying Price,Sell Price,Total\n";
    
    for (const sale of sales) {
        const d = new Date(sale.date);
        const dateStr = d.toLocaleDateString('en-GB');
        
        for (const item of sale.items) {
            let barcode = item.barcode;
            let buyingPrice = item.buyingPrice || 0;

            // Fallback for old data without barcode/buying price stored in sale record
            if ((!barcode || !buyingPrice) && item.productId) {
                const p = await DB.products.getById(item.productId);
                if (p) {
                    if (!barcode) barcode = p.barcode;
                    if (!buyingPrice) buyingPrice = p.buyingPrice || 0;
                }
            }

            csv += `${dateStr},${sale.id},"${barcode || ''}","${item.name}",${item.quantity},${buyingPrice.toFixed(2)},${item.price.toFixed(2)},${item.total.toFixed(2)}\n`;
        }
    }
    
    downloadCSV(csv, `Sales_Report_${fromDate}_to_${toDate}.csv`);
}

async function exportPurchasesCSV() {
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates first');
        return;
    }
    
    const purchases = await DB.purchases.getByDateRange(fromDate, toDate);
    
    if (purchases.length === 0) {
        alert('No purchases found for the selected period');
        return;
    }
    
    let csv = "Date,Item Name,Barcode,Quantity,Buy Price,Sell Price,Total Cost\n";
    
    for (const p of purchases) {
        const d = new Date(p.date);
        const dateStr = d.toLocaleDateString('en-GB');
        
        for (const item of p.items) {
            let barcode = item.barcode;
            const bp = item.buyingPrice || item.cost || 0;
            let sp = item.sellingPrice || 0;

            // Fallback for old data
            if ((!barcode || !sp) && item.productId) {
                const prod = await DB.products.getById(item.productId);
                if (prod) {
                    if (!barcode) barcode = prod.barcode;
                    if (!sp) sp = prod.price || 0;
                }
            }

            csv += `${dateStr},"${item.name}","${barcode || ''}",${item.quantity},${bp.toFixed(2)},${sp.toFixed(2)},${(item.total || (bp * item.quantity)).toFixed(2)}\n`;
        }
    }
    
    downloadCSV(csv, `Purchase_Report_${fromDate}_to_${toDate}.csv`);
}

async function exportStockCSV() {
    const fromDate = document.getElementById('report-from-date')?.value;
    const toDate = document.getElementById('report-to-date')?.value;

    const products = await DB.products.getAll();

    if (products.length === 0) {
        alert('No products in stock to export');
        return;
    }

    // If a date range is selected, export stock movement summary for that range.
    if (fromDate && toDate) {
        const sales = await DB.sales.getByDateRange(fromDate, toDate);
        const purchases = await DB.purchases.getByDateRange(fromDate, toDate);

        const rowsMap = new Map();

        const makeKey = (item) => {
            if (item.productId) return `pid:${item.productId}`;
            if (item.barcode) return `barcode:${item.barcode}`;
            return `name:${item.name || ''}`;
        };

        const ensureRow = (key, defaults = {}) => {
            if (!rowsMap.has(key)) {
                rowsMap.set(key, {
                    barcode: defaults.barcode || '',
                    name: defaults.name || '',
                    currentStock: defaults.currentStock || 0,
                    buyingPrice: defaults.buyingPrice || 0,
                    sellingPrice: defaults.sellingPrice || 0,
                    purchasedQty: 0,
                    soldQty: 0
                });
            }
            return rowsMap.get(key);
        };

        // Seed with current products so current stock is always accurate in export.
        products.forEach((p) => {
            const key = `pid:${p.id}`;
            ensureRow(key, {
                barcode: p.barcode || '',
                name: p.name || '',
                currentStock: p.stock || 0,
                buyingPrice: p.buyingPrice || 0,
                sellingPrice: p.price || 0
            });
        });

        purchases.forEach((purchase) => {
            (purchase.items || []).forEach((item) => {
                const key = makeKey(item);
                const row = ensureRow(key, {
                    barcode: item.barcode || '',
                    name: item.name || '',
                    buyingPrice: item.buyingPrice || item.cost || 0,
                    sellingPrice: item.sellingPrice || 0
                });
                row.purchasedQty += Number(item.quantity) || 0;
                if (!row.barcode && item.barcode) row.barcode = item.barcode;
                if (!row.name && item.name) row.name = item.name;
                if (!row.buyingPrice) row.buyingPrice = item.buyingPrice || item.cost || 0;
                if (!row.sellingPrice) row.sellingPrice = item.sellingPrice || 0;
            });
        });

        sales.forEach((sale) => {
            (sale.items || []).forEach((item) => {
                const key = makeKey(item);
                const row = ensureRow(key, {
                    barcode: item.barcode || '',
                    name: item.name || '',
                    buyingPrice: item.buyingPrice || 0,
                    sellingPrice: item.price || 0
                });
                row.soldQty += Number(item.quantity) || 0;
                if (!row.barcode && item.barcode) row.barcode = item.barcode;
                if (!row.name && item.name) row.name = item.name;
                if (!row.buyingPrice) row.buyingPrice = item.buyingPrice || 0;
                if (!row.sellingPrice) row.sellingPrice = item.price || 0;
            });
        });

        const rows = Array.from(rowsMap.values()).filter((r) => r.purchasedQty > 0 || r.soldQty > 0);

        if (rows.length === 0) {
            alert('No stock movement found for the selected period');
            return;
        }

        let csv = "Barcode,Item Name,Current Stock Qty,Purchased Qty (Range),Sold Qty (Range),Net Change (Range),Buying Price,Selling Price\n";

        rows.forEach((r) => {
            const netChange = r.purchasedQty - r.soldQty;
            csv += `"${r.barcode}","${r.name}",${r.currentStock},${r.purchasedQty},${r.soldQty},${netChange},${(r.buyingPrice || 0).toFixed(2)},${(r.sellingPrice || 0).toFixed(2)}\n`;
        });

        downloadCSV(csv, `Stock_Report_${fromDate}_to_${toDate}.csv`);
        return;
    }

    // Fallback: export current stock snapshot when no date range is selected.
    let csv = "Barcode,Item Name,Stock Qty,Buying Price,Selling Price,Total Value (Cost)\n";

    products.forEach(p => {
        const bp = p.buyingPrice || 0;
        const sp = p.price || 0;
        const qty = p.stock || 0;
        const totalValue = bp * qty;

        csv += `"${p.barcode || ''}","${p.name}",${qty},${bp.toFixed(2)},${sp.toFixed(2)},${totalValue.toFixed(2)}\n`;
    });

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    downloadCSV(csv, `Current_Stock_Report_${dateStr}.csv`);
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Purchase / Receive Stock Logic
// Purchase / Receive Stock Logic
function showReceiveStockModal() {
    console.log('Opening Receive Stock Modal...');
    try {
        purchaseCart = [];
        
        // Element Validation
        const supplierEl = document.getElementById('purchase-supplier');
        if (!supplierEl) throw new Error('Supplier input missing');
        supplierEl.value = '';

        const dateEl = document.getElementById('purchase-date');
        if (!dateEl) throw new Error('Date input missing');
        dateEl.value = new Date().toISOString().split('T')[0];
        
        // Reset Add Item Form
        const barcodeEl = document.getElementById('purchase-barcode');
        if (!barcodeEl) throw new Error('Barcode input missing');
        barcodeEl.value = '';

        document.getElementById('purchase-name').value = '';
        document.getElementById('purchase-product-id').value = '';
        document.getElementById('purchase-is-new').value = 'true';
        document.getElementById('purchase-category').value = '';
        document.getElementById('purchase-type').value = 'unit';
        document.getElementById('purchase-qty').value = '';
        document.getElementById('purchase-cost').value = '';
        document.getElementById('purchase-price').value = '';
        document.getElementById('purchase-free-item').checked = false;
        
        const tbody = document.getElementById('purchase-items-body');
        if (!tbody) throw new Error('Table body missing');
        tbody.innerHTML = '';

        const totalEl = document.getElementById('purchase-total');
        if (!totalEl) throw new Error('Total element missing');
        totalEl.textContent = '0.00';
        
        // Check DB
        if (typeof DB === 'undefined' || !DB.products) {
             console.error('DB not initialized');
             alert('Database error. Please refresh page.');
             return;
        }

        // Load Categories for Autocomplete
        loadCategories();
        
        const modal = document.getElementById('receive-stock-modal');
        if (!modal) throw new Error('Modal missing');
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            if (barcodeEl) barcodeEl.focus();
        }, 100);

    } catch (error) {
        console.error('Error opening modal:', error);
        alert('Error: ' + error.message);
    }
}

function closeReceiveStockModal() {
    document.getElementById('receive-stock-modal').classList.add('hidden');
}



// Barcode Handler (Debounced or on Enter)
let purchaseBarcodeTimeout;
async function handlePurchaseBarcode(barcode) {
    if (!barcode || barcode.length < 3) return;
    
    clearTimeout(purchaseBarcodeTimeout);
    purchaseBarcodeTimeout = setTimeout(async () => {
        const product = await DB.products.getByBarcode(barcode);
        
        if (product) {
            // Found: Populate fields and set to "Update" mode
            document.getElementById('purchase-product-id').value = product.id;
            document.getElementById('purchase-is-new').value = 'false';
            
            document.getElementById('purchase-name').value = product.name;
            document.getElementById('purchase-category').value = product.category;
            document.getElementById('purchase-type').value = product.type;
            document.getElementById('purchase-cost').value = product.buyingPrice || '';
            document.getElementById('purchase-price').value = product.price || '';
            
            // Move focus to quantity
            document.getElementById('purchase-qty').focus();
        } else {
            // Not Found: Switch to "New" mode but keep barcode
            document.getElementById('purchase-product-id').value = '';
            document.getElementById('purchase-is-new').value = 'true';
            
            // Should we clear other fields? Probably yes to avoid confusion with previous search
            document.getElementById('purchase-name').value = '';
            document.getElementById('purchase-cost').value = '';
            document.getElementById('purchase-price').value = '';
        }
    }, 400);
}



async function handlePurchaseBarcodeEnter(barcode) {
    if (!barcode) return;
    
    const product = await DB.products.getByBarcode(barcode);
    
    if (product) {
        // Found: Populate and set Update Mode
        selectPurchaseProduct(product.id);
    } else {
        // Not Found: New Mode
        // Don't clear barcode, let user fill the rest
        document.getElementById('purchase-product-id').value = '';
        document.getElementById('purchase-is-new').value = 'true';
        document.getElementById('purchase-name').focus();
    }
}

async function searchPurchaseProducts(query) {
    // If user types, we reset to "New" mode unless they pick a result
    document.getElementById('purchase-product-id').value = '';
    document.getElementById('purchase-is-new').value = 'true';
    
    const resultsContainer = document.getElementById('purchase-search-results');
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
    }
    
    const results = await DB.products.search(query);
    
    if (results.length === 0) {
       resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500">No product found</div>';
    } else {
        resultsContainer.innerHTML = results.slice(0, 10).map(p => `
            <div class="p-3 hover:bg-gray-100 cursor-pointer border-b" onclick="selectPurchaseProduct(${p.id})">
                <div class="font-bold text-gray-800">${p.name}</div>
                <div class="text-xs text-gray-500">${p.barcode} | Stock: ${p.stock}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

async function selectPurchaseProduct(productId) {
    const product = await DB.products.getById(productId);
    if (!product) return;
    
    document.getElementById('purchase-product-id').value = product.id;
    document.getElementById('purchase-is-new').value = 'false';
    
    document.getElementById('purchase-barcode').value = product.barcode;
    document.getElementById('purchase-name').value = product.name;
    document.getElementById('purchase-category').value = product.category;
    document.getElementById('purchase-type').value = product.type;
    document.getElementById('purchase-cost').value = product.buyingPrice || '';
    document.getElementById('purchase-price').value = product.price || '';
    document.getElementById('purchase-min-stock').value = product.minStock || 5;

    // Notify if current stock is low
    if (product.stock <= (product.minStock || 5)) {
        showNotification(`Current Stock is Low! (${product.stock} ${product.type === 'weight' ? 'kg' : 'units'} left) \n (දැනට තොග අඩුයි!)`, 'warning');
    }
    
    document.getElementById('purchase-search-results').classList.add('hidden');
    document.getElementById('purchase-qty').focus();
}

async function addPurchaseItem() {
    const idVal = document.getElementById('purchase-product-id').value;
    const productId = idVal ? parseInt(idVal) : null;
    const isNew = !productId;
    
    const barcode = document.getElementById('purchase-barcode').value;
    const name = document.getElementById('purchase-name').value;
    const category = document.getElementById('purchase-category').value;
    const type = document.getElementById('purchase-type').value;
    const qty = parseFloat(document.getElementById('purchase-qty').value);
    const minStock = parseFloat(document.getElementById('purchase-min-stock').value) || 5;
    const costInput = parseFloat(document.getElementById('purchase-cost').value);
    const priceInput = parseFloat(document.getElementById('purchase-price').value);
    const isFree = document.getElementById('purchase-free-item').checked;
    
    // Validation
    if (!name || isNaN(qty) || isNaN(priceInput)) {
        alert('Please fill Name, Selling Price and Quantity');
        return;
    }
    
    const cost = isFree ? 0 : (isNaN(costInput) ? 0 : costInput);
    
    if (isNew) {
        if (!barcode || !category) {
            alert('New Products require Barcode and Category');
            return;
        }
        // Duplicate Barcode/Price Check
        const existing = await DB.products.getByBarcodeAndPrice(barcode, priceInput);
        if (existing) {
            alert(`Barcode already exists for another product.`);
            return;
        }
    }
    
    purchaseCart.push({
        productId,
        isNew,
        barcode,
        name,
        category,
        type,
        quantity: qty,
        minStock,
        buyingPrice: cost,
        sellingPrice: priceInput,
        isFree,
        total: cost * qty
    });
    
    updatePurchaseTable();
    
    // Clear Form for next item
    document.getElementById('purchase-barcode').value = '';
    document.getElementById('purchase-name').value = '';
    document.getElementById('purchase-product-id').value = '';
    document.getElementById('purchase-is-new').value = 'true';
    document.getElementById('purchase-category').value = '';
    document.getElementById('purchase-qty').value = '';
    document.getElementById('purchase-min-stock').value = '';
    document.getElementById('purchase-cost').value = '';
    document.getElementById('purchase-price').value = '';
    document.getElementById('purchase-free-item').checked = false;
    document.getElementById('purchase-barcode').focus();
}

function updatePurchaseTable() {
    const tbody = document.getElementById('purchase-items-body');
    const totalEl = document.getElementById('purchase-total');
    
    if (purchaseCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400">No items added</td></tr>';
        totalEl.textContent = '0.00';
        return;
    }
    
    tbody.innerHTML = purchaseCart.map((item, index) => `
        <tr>
            <td class="px-4 py-2 text-sm">
                <div class="font-bold text-gray-800">${item.name}</div>
                <div class="text-xs text-gray-500">${item.barcode} ${item.isNew ? '<span class="text-green-600 font-bold">(NEW)</span>' : ''}</div>
            </td>
            <td class="px-4 py-2 text-sm text-right font-mono">${item.sellingPrice.toFixed(2)}</td>
            <td class="px-4 py-2 text-sm text-right">${item.quantity}</td>
            <td class="px-4 py-2 text-sm text-right text-gray-600">${item.buyingPrice.toFixed(2)}</td>
            <td class="px-4 py-2 text-sm text-right font-bold">${item.total.toFixed(2)}</td>
            <td class="px-4 py-2 text-center">
                <button onclick="removePurchaseItem(${index})" class="text-red-500 hover:text-red-700"><i class="ri-delete-bin-line"></i></button>
            </td>
        </tr>
    `).join('');
    
    const total = purchaseCart.reduce((sum, item) => sum + item.total, 0);
    totalEl.textContent = total.toFixed(2);
}

function removePurchaseItem(index) {
    purchaseCart.splice(index, 1);
    updatePurchaseTable();
}

async function savePurchase() {
    if (purchaseCart.length === 0) {
        alert('Please add items first');
        return;
    }
    
    const supplier = document.getElementById('purchase-supplier').value;
    const date = document.getElementById('purchase-date').value;
    
    if (!date) {
        alert('Please select date');
        return;
    }
    
    try {
        const totalCost = purchaseCart.reduce((sum, item) => sum + item.total, 0);
        
        // 1. Process Products (Update or Create)
        const finalItems = [];
        
        for (const item of purchaseCart) {
            let pId = item.productId;
            
            if (item.isNew) {
                // Create New Product
                pId = await DB.products.add({
                    barcode: item.barcode,
                    name: item.name,
                    category: item.category,
                    type: item.type,
                    price: item.sellingPrice,
                    buyingPrice: item.buyingPrice,
                    stock: item.quantity,
                    minStock: item.minStock
                });
            } else {
                // Update Existing Product or Create New Price Batch
                const originalProduct = await DB.products.getById(pId);
                
                if (originalProduct) {
                    if (originalProduct.price === item.sellingPrice) {
                        // Same Price: Update stock of this specific row
                        const updateData = {
                            stock: originalProduct.stock + item.quantity
                        };
                        // Update Buying Price if not free
                        if (!item.isFree && item.buyingPrice > 0) {
                            updateData.buyingPrice = item.buyingPrice;
                        }
                        // Sync Name/Category/MinStock updates if any changed in form
                        updateData.name = item.name;
                        updateData.category = item.category;
                        updateData.minStock = item.minStock;
                        
                        await DB.products.update(pId, updateData);
                    } else {
                        // Different Price: Check if another batch with this price exists
                        const existingBatch = await DB.products.getByBarcodeAndPrice(item.barcode, item.sellingPrice);
                        
                        if (existingBatch) {
                            // Found another row with same barcode AND same NEW price: Update it
                            const updateData = {
                                stock: existingBatch.stock + item.quantity
                            };
                            if (!item.isFree && item.buyingPrice > 0) {
                                updateData.buyingPrice = item.buyingPrice;
                            }
                            await DB.products.update(existingBatch.id, updateData);
                            pId = existingBatch.id; // Update pId for the purchase record
                        } else {
                            // No batch with this price exists: Create a NEW batch row
                            pId = await DB.products.add({
                                barcode: item.barcode,
                                name: item.name,
                                category: item.category,
                                type: item.type,
                                price: item.sellingPrice,
                                buyingPrice: item.buyingPrice,
                                stock: item.quantity,
                                minStock: item.minStock
                            });
                        }
                    }
                }
            }
            
            // Prepare Item for Purchase Record
            finalItems.push({
                productId: pId,
                barcode: item.barcode,
                name: item.name,
                quantity: item.quantity,
                type: item.type,
                buyingPrice: item.buyingPrice,
                sellingPrice: item.sellingPrice,
                total: item.total
            });
        }
        
        // 2. Save Purchase Record
        await DB.purchases.add({
            supplier: supplier || 'Unknown',
            date,
            totalCost,
            items: finalItems
        });
        
        alert('Stock received successfully!');
        closeReceiveStockModal();
        await loadProducts();
        await loadCategories();
        displayInventory();
        
    } catch (error) {
        console.error('Purchase error:', error);
        alert('Error saving purchase.');
    }
}

// View sale details
async function viewSaleDetails(saleId) {
    const sale = await DB.sales.getById(saleId);
    if (!sale) return;
    
    showReceipt(saleId, sale);
}

// Settings Functions
async function loadShopSettings() {
    try {
        const settings = await DB.shop_settings.get();
        if (settings) {
            document.getElementById('shop-name').value = settings.name || '';
            document.getElementById('shop-phone').value = settings.phone || '';
            document.getElementById('shop-address').value = settings.address || '';
            document.getElementById('shop-info').value = settings.info || '';
        }
    } catch (error) {
        console.error('Error loading shop settings:', error);
    }
}

async function saveShopSettings(event) {
    event.preventDefault();
    
    const settings = {
        name: document.getElementById('shop-name').value,
        phone: document.getElementById('shop-phone').value,
        address: document.getElementById('shop-address').value,
        info: document.getElementById('shop-info').value
    };
    
    try {
        await DB.shop_settings.save(settings);
        alert('Shop settings saved successfully! These details will appear on your bills.');
    } catch (error) {
        console.error('Error saving shop settings:', error);
        alert('Error saving settings. Please try again.');
    }
}

async function exportData() {
    try {
        const data = await DB.exportAll();
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sillara-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        alert('Data exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting data. Please try again.');
    }
}

async function importData(input) {
    const file = input.files[0];
    if (!file) return;

    if (!checkAdminPassword()) {
        input.value = '';
        return;
    }
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!confirm('This will replace all existing data. Continue?')) {
            input.value = '';
            return;
        }
        
        await DB.importAll(data);
        await loadProducts();
        await updateDashboard();
        
        alert('Data imported successfully!');
        
        // Reload current page
        showPage(currentPage);
    } catch (error) {
        console.error('Import error:', error);
        alert('Error importing data. Please check the file format.');
    }
    
    input.value = '';
}

async function confirmClearData() {
    if (!checkAdminPassword()) return;
    if (!confirm('⚠️ WARNING: This will delete ALL data permanently! Are you sure?')) {
        return;
    }
    
    if (!confirm('This action cannot be undone. Click OK to proceed.')) {
        return;
    }
    
    try {
        await DB.clearAll();
        await loadProducts();
        await updateDashboard();
        
        alert('All data cleared successfully!');
        showPage('dashboard');
    } catch (error) {
        console.error('Clear data error:', error);
        alert('Error clearing data. Please try again.');
    }
}

async function loadSampleData() {
    if (!checkAdminPassword()) return;
    if (!confirm('Load sample products and sales data?')) {
        return;
    }
    
    try {
        await DB.loadSampleData();
        await loadProducts();
        await updateDashboard();
        
        alert('Sample data loaded successfully!');
        
        // Refresh current page
        showPage(currentPage);
    } catch (error) {
        console.error('Load sample data error:', error);
        alert('Error loading sample data. Please try again.');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N for new bill (POS page)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        showPage('pos');
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        closeProductModal();
        closeQuantityModal();
        closeReceiptModal();
        closeReceiveStockModal();
    }
});

console.log('Sillara-POS App Ready! 🛒');
