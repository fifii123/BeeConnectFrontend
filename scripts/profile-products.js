// profile-products.js - Zarządzanie produktami użytkownika

const API_BASE = 'http://localhost:8080/api';

let myProducts = [];
let myPurchases = [];
let currentEditingProduct = null;

// ==================== ŁADOWANIE PRODUKTÓW ====================
async function loadMyProducts() {
    try {
        const response = await fetch(`${API_BASE}/products/my`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Nie udało się pobrać produktów');
        }

        myProducts = await response.json();
        displayMyProducts();

    } catch (error) {
        console.error('Błąd ładowania produktów:', error);
        showProductsError('Nie udało się załadować Twoich produktów');
    }
}

function displayMyProducts() {
    const container = document.getElementById('products-list');
    if (!container) return;

    if (myProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Nie masz jeszcze żadnych produktów</h3>
                <p>Dodaj swój pierwszy produkt do marketplace</p>
                <button class="btn btn-primary" onclick="openAddProductModal()">
                    <i class="fas fa-plus"></i> Dodaj produkt
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = myProducts.map(product => `
        <div class="product-item ${!product.available ? 'product-unavailable' : ''}">
            <div class="product-item-image">
                <img src="${product.imageBase64 ? `data:image/jpeg;base64,${product.imageBase64}` : 'assets/default-product.jpg'}" alt="${product.name}">
                ${!product.available ? '<span class="badge badge-danger">Niedostępny</span>' : ''}
                ${product.stock === 0 ? '<span class="badge badge-warning">Brak w magazynie</span>' : ''}
            </div>
            <div class="product-item-info">
                <h4>${product.name}</h4>
                <p class="product-category">${getCategoryName(product.category)}</p>
                <p class="product-description">${truncateText(product.description, 100)}</p>
                <div class="product-stats">
                    <span><i class="fas fa-boxes"></i> Stock: ${product.stock}</span>
                    <span><i class="fas fa-star"></i> ${product.rating.toFixed(1)} (${product.reviewCount})</span>
                </div>
            </div>
            <div class="product-item-price">
                <div class="price">${product.price.toFixed(2)} PLN</div>
                ${product.weight ? `<div class="unit">${product.weight} ${product.weightUnit}</div>` : ''}
            </div>
            <div class="product-item-actions">
                <button class="btn btn-sm btn-primary" onclick="editProduct(${product.id})" title="Edytuj">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="toggleProductAvailability(${product.id})" title="${product.available ? 'Ukryj' : 'Pokaż'}">
                    <i class="fas fa-eye${product.available ? '-slash' : ''}"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})" title="Usuń">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==================== DODAWANIE PRODUKTU ====================
function openAddProductModal() {
    currentEditingProduct = null;

    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');

    modalTitle.textContent = 'Dodaj nowy produkt';
    form.reset();
    document.getElementById('product-image-preview').style.display = 'none';

    modal.style.display = 'block';
}

async function saveProduct(event) {
    event.preventDefault();

    const formData = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        stock: parseInt(document.getElementById('product-stock').value),
        location: document.getElementById('product-location').value,
        weight: parseFloat(document.getElementById('product-weight').value) || null,
        weightUnit: document.getElementById('product-weight-unit').value,
        imageBase64: document.getElementById('product-image-base64').value || null
    };

    try {
        const submitBtn = document.querySelector('#product-form button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zapisywanie...';

        let response;
        if (currentEditingProduct) {
            // Edycja
            formData.id = currentEditingProduct;
            response = await fetch(`${API_BASE}/products`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
        } else {
            // Dodawanie
            response = await fetch(`${API_BASE}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się zapisać produktu');
        }

        showNotification(currentEditingProduct ? 'Produkt zaktualizowany' : 'Produkt dodany pomyślnie', 'success');
        closeProductModal();
        await loadMyProducts();

    } catch (error) {
        console.error('Błąd zapisywania produktu:', error);
        showNotification(error.message, 'error');
    } finally {
        const submitBtn = document.querySelector('#product-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Zapisz';
        }
    }
}

// ==================== EDYCJA PRODUKTU ====================
async function editProduct(productId) {
    const product = myProducts.find(p => p.id === productId);
    if (!product) return;

    currentEditingProduct = productId;

    document.getElementById('product-modal-title').textContent = 'Edytuj produkt';
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-location').value = product.location || '';
    document.getElementById('product-weight').value = product.weight || '';
    document.getElementById('product-weight-unit').value = product.weightUnit || 'kg';
    document.getElementById('product-image-base64').value = product.imageBase64 || '';

    if (product.imageBase64) {
        const preview = document.getElementById('product-image-preview');
        preview.src = `data:image/jpeg;base64,${product.imageBase64}`;
        preview.style.display = 'block';
    }

    document.getElementById('product-modal').style.display = 'block';
}

// ==================== USUWANIE PRODUKTU ====================
async function deleteProduct(productId) {
    if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return;

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się usunąć produktu');
        }

        showNotification('Produkt usunięty', 'success');
        await loadMyProducts();

    } catch (error) {
        console.error('Błąd usuwania produktu:', error);
        showNotification(error.message, 'error');
    }
}

// ==================== TOGGLE AVAILABILITY ====================
async function toggleProductAvailability(productId) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}/toggle-availability`, {
            method: 'PUT',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Nie udało się zmienić dostępności');
        }

        showNotification('Dostępność zmieniona', 'success');
        await loadMyProducts();

    } catch (error) {
        console.error('Błąd zmiany dostępności:', error);
        showNotification(error.message, 'error');
    }
}

// ==================== UPLOAD OBRAZKA ====================
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Sprawdź rozmiar (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Plik jest za duży. Maksymalny rozmiar to 2MB', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result.split(',')[1]; // Usuń prefix "data:image/jpeg;base64,"
        document.getElementById('product-image-base64').value = base64;

        const preview = document.getElementById('product-image-preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// ==================== HISTORIA ZAKUPÓW ====================
async function loadMyPurchases() {
    try {
        const response = await fetch(`${API_BASE}/orders/my-purchases`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Nie udało się pobrać historii zakupów');
        }

        myPurchases = await response.json();
        console.log("ch");
        console.log(myPurchases);
        displayMyPurchases();

    } catch (error) {
        console.error('Błąd ładowania zakupów:', error);
        showPurchasesError('Nie udało się załadować historii zakupów');
    }
}

function displayMyPurchases() {
    const container = document.getElementById('bought-products');
    if (!container) {
        console.log('No pewno chcesz');
        return;
    }

    if (myPurchases.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-bag"></i>
                <h3>Nie masz jeszcze żadnych zakupów</h3>
                <p>Przejdź do marketplace i kup swój pierwszy produkt</p>
                <a href="marketplace.html" class="btn btn-primary">
                    <i class="fas fa-store"></i> Przejdź do marketplace
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = myPurchases.map(order => `
        <div class="order-item">
            <div class="order-header">
                <div class="order-id">Zamówienie #${order.id}</div>
                <div class="order-date">${formatDate(order.orderedAt)}</div>
                <div class="order-status status-${order.status.toLowerCase()}">${getStatusName(order.status)}</div>
            </div>
            <div class="order-body">
                <div class="order-product">
                    <img src="${order.productImage ? `data:image/jpeg;base64,${order.productImage}` : 'assets/default-product.jpg'}" alt="${order.productName}">
                    <div class="order-product-info">
                        <h4>${order.productName}</h4>
                        <p class="order-seller"><i class="fas fa-user"></i> ${order.sellerFirstname} ${order.sellerLastname}</p>
                        <p class="order-quantity">Ilość: ${order.quantity} szt.</p>
                    </div>
                </div>
                <div class="order-price">
                    <div class="price-label">Całkowita cena:</div>
                    <div class="price-value">${order.totalPrice.toFixed(2)} PLN</div>
                    <div class="price-unit">(${order.pricePerUnit.toFixed(2)} PLN/szt.)</div>
                </div>
            </div>
            ${order.deliveryAddress ? `
                <div class="order-footer">
                    <p><strong>Adres dostawy:</strong> ${order.deliveryAddress}</p>
                    ${order.buyerNotes ? `<p><strong>Uwagi:</strong> ${order.buyerNotes}</p>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// ==================== MODAL ====================
function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
    document.getElementById('product-form').reset();
    document.getElementById('product-image-preview').style.display = 'none';
    currentEditingProduct = null;
}

// ==================== POMOCNICZE ====================
function getCategoryName(category) {
    const categories = {
        'HONEY': 'Miód',
        'WAX': 'Wosk',
        'POLLEN': 'Pyłek',
        'PROPOLIS': 'Propolis',
        'ROYAL_JELLY': 'Mleczko pszczele',
        'HONEYCOMB': 'Plaster miodu',
        'EQUIPMENT': 'Sprzęt',
        'OTHER': 'Inne'
    };
    return categories[category] || category;
}

function getStatusName(status) {
    const statuses = {
        'PENDING': 'Oczekujące',
        'CONFIRMED': 'Potwierdzone',
        'PROCESSING': 'W realizacji',
        'SHIPPED': 'Wysłane',
        'DELIVERED': 'Dostarczone',
        'COMPLETED': 'Zakończone',
        'CANCELLED': 'Anulowane'
    };
    return statuses[status] || status;
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showProductsError(message) {
    const container = document.getElementById('products-list');
    if (container) {
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadMyProducts()">Spróbuj ponownie</button>
            </div>
        `;
    }
}

function showPurchasesError(message) {
    const container = document.getElementById('purchases-list');
    if (container) {
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadMyPurchases()">Spróbuj ponownie</button>
            </div>
        `;
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    // Form submit
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', saveProduct);
    }

    // Image upload
    const imageInput = document.getElementById('product-image');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }

    // Close modal on X or outside click
    const modal = document.getElementById('product-modal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                closeProductModal();
            }
        };
    }

    // Load data based on active tab
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab');

    if (activeTab === 'products') {
        loadMyProducts();
    } else if (activeTab === 'bought-products') {
        loadMyPurchases();
    }
});

// CSS styles
const style = document.createElement('style');
style.textContent = `
    .empty-state, .error-state {
        text-align: center;
        padding: 60px 20px;
    }
    
    .empty-state i, .error-state i {
        font-size: 64px;
        color: #ddd;
        margin-bottom: 20px;
    }
    
    .error-state i {
        color: #ff6b6b;
    }
    
    .empty-state h3 {
        color: #666;
        margin-bottom: 10px;
    }
    
    .empty-state p, .error-state p {
        color: #999;
        margin-bottom: 20px;
    }
    
    .product-item {
        display: flex;
        gap: 20px;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 15px;
        align-items: center;
    }
    
    .product-item-image {
        width: 100px;
        height: 100px;
        position: relative;
    }
    
    .product-item-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
    }
    
    .product-item-info {
        flex: 1;
    }
    
    .product-item-info h4 {
        margin: 0 0 5px 0;
        color: #333;
    }
    
    .product-category {
        font-size: 12px;
        color: var(--primary);
        font-weight: 600;
        margin-bottom: 8px;
    }
    
    .product-description {
        font-size: 13px;
        color: #666;
        margin-bottom: 10px;
    }
    
    .product-stats span {
        margin-right: 15px;
        font-size: 13px;
        color: #888;
    }
    
    .product-item-price {
        text-align: right;
    }
    
    .product-item-price .price {
        font-size: 22px;
        font-weight: 700;
        color: var(--primary);
    }
    
    .product-item-price .unit {
        font-size: 12px;
        color: #888;
    }
    
    .product-item-actions {
        display: flex;
        gap: 8px;
        flex-direction: column;
    }
    
    .product-unavailable {
        opacity: 0.6;
    }
    
    .badge {
        position: absolute;
        top: 5px;
        right: 5px;
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 4px;
        color: white;
        font-weight: 600;
    }
    
    .badge-danger {
        background: #dc3545;
    }
    
    .badge-warning {
        background: #ffa500;
    }
    
    .order-item {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 15px;
        overflow: hidden;
    }
    
    .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .order-id {
        font-weight: 700;
        color: #333;
    }
    
    .order-date {
        font-size: 13px;
        color: #666;
    }
    
    .order-status {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .status-completed {
        background: #d4edda;
        color: #155724;
    }
    
    .status-pending {
        background: #fff3cd;
        color: #856404;
    }
    
    .status-cancelled {
        background: #f8d7da;
        color: #721c24;
    }
    
    .order-body {
        display: flex;
        justify-content: space-between;
        padding: 20px;
    }
    
    .order-product {
        display: flex;
        gap: 15px;
        flex: 1;
    }
    
    .order-product img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 6px;
    }
    
    .order-product-info h4 {
        margin: 0 0 8px 0;
        color: #333;
    }
    
    .order-seller, .order-quantity {
        font-size: 13px;
        color: #666;
        margin: 4px 0;
    }
    
    .order-price {
        text-align: right;
    }
    
    .price-label {
        font-size: 12px;
        color: #888;
        margin-bottom: 5px;
    }
    
    .price-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--primary);
    }
    
    .price-unit {
        font-size: 12px;
        color: #888;
    }
    
    .order-footer {
        padding: 15px 20px;
        background: #f8f9fa;
        border-top: 1px solid #e0e0e0;
        font-size: 13px;
    }
    
    .order-footer p {
        margin: 5px 0;
        color: #666;
    }
    
    .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    }
    
    .notification-toast.show {
        transform: translateX(0);
    }
    
    .notification-success { border-left: 4px solid #28a745; }
    .notification-error { border-left: 4px solid #dc3545; }
    .notification-info { border-left: 4px solid #17a2b8; }
    
    .notification-success i { color: #28a745; }
    .notification-error i { color: #dc3545; }
    .notification-info i { color: #17a2b8; }
    
    #product-image-preview {
        max-width: 200px;
        max-height: 200px;
        margin-top: 10px;
        border-radius: 8px;
    }
`;
document.head.appendChild(style);