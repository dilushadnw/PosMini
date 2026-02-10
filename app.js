// Main Application Logic for Sillara-POS
// Global variables
let currentPage = 'dashboard';
let cart = [];
let products = [];
let currentFilter = 'all';

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
    await updateDashboard();
    console.log('Sillara-POS Application initialized!');
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
    } else if (pageName === 'inventory') {
        displayInventory();
    } else if (pageName === 'reports') {
        generateReport();
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
    
    // Check stock
    if (quantity > product.stock) {
        alert(`Not enough stock! Available: ${product.stock} ${product.type === 'weight' ? 'kg' : 'units'}`);
        return;
    }
    
    // Check if product already in cart
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.total = existingItem.quantity * existingItem.price;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            type: product.type,
            total: product.price * quantity
        });
    }
    
    updateCart();
    closeQuantityModal();
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
        
        // Create sale record
        const sale = {
            totalAmount,
            items: cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
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
        alert('Error completing sale. Please try again.');
    }
}

// Show receipt
function showReceipt(saleId, sale) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB');
    
    const receiptContent = `
        <div class="receipt-header">
            <div class="receipt-title">සිල්ලර බඩු කඩය</div>
            <div class="receipt-title">Sillara Store</div>
            <div class="receipt-info">
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
        
        <div class="receipt-total">
            <span>TOTAL:</span>
            <span>Rs. ${sale.totalAmount.toFixed(2)}</span>
        </div>
        
        <div class="receipt-footer">
            Thank you for your business!<br>
            ස්තූතියි! පිං!<br>
            <br>
            Powered by Sillara-POS
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptContent;
    document.getElementById('receipt-modal').classList.remove('hidden');
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
}

// Inventory Management
async function displayInventory() {
    const products = await DB.products.getAll();
    const tbody = document.getElementById('inventory-table-body');
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-12 text-gray-400">
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
                <td class="font-semibold text-gray-900">${product.name}</td>
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
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-type').value = product.type;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-min-stock').value = product.minStock || 5;
    
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// Save product
async function saveProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        type: document.getElementById('product-type').value,
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
async function generateReport() {
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates');
        return;
    }
    
    const sales = await DB.sales.getByDateRange(fromDate, toDate);
    
    // Calculate statistics
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const avgBill = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Update stats
    document.getElementById('report-total-sales').textContent = totalSales.toFixed(2);
    document.getElementById('report-total-transactions').textContent = totalTransactions;
    document.getElementById('report-avg-bill').textContent = avgBill.toFixed(2);
    
    // Display sales table
    const tbody = document.getElementById('sales-report-table-body');
    
    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-gray-400">
                    <i class="ri-file-list-line text-6xl mb-4 block"></i>
                    <p class="font-sinhala">විකුණුම් නැත</p>
                    <p>No sales found for selected period</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = sales.reverse().map(sale => {
        const date = new Date(sale.date);
        const dateStr = date.toLocaleDateString('en-GB');
        const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <tr>
                <td class="font-semibold text-primary-600">#${sale.id}</td>
                <td>
                    <div>${dateStr}</div>
                    <div class="text-xs text-gray-500">${timeStr}</div>
                </td>
                <td>
                    <div class="text-sm text-gray-600">
                        ${sale.items.length} item${sale.items.length > 1 ? 's' : ''}
                    </div>
                </td>
                <td class="font-bold text-gray-900">Rs. ${sale.totalAmount.toFixed(2)}</td>
                <td>
                    <button onclick="viewSaleDetails(${sale.id})" 
                            class="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-all">
                        <i class="ri-eye-line"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// View sale details
async function viewSaleDetails(saleId) {
    const sale = await DB.sales.getById(saleId);
    if (!sale) return;
    
    showReceipt(saleId, sale);
}

// Settings Functions
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
    }
});

console.log('Sillara-POS App Ready! 🛒');
