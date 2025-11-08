// product-details.js - Szczegóły produktu i zakup

const API_BASE = 'http://localhost:8080/api';
let currentProduct = null;
let currentUser = null;

// ==================== INICJALIZACJA ====================
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    await loadProductDetails();
    setupEventListeners();
});

// ==================== ŁADOWANIE SZCZEGÓŁÓW PRODUKTU ====================
async function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError('Nie znaleziono produktu');
        return;
    }

    try {
        showLoading(true);

        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Produkt nie został znaleziony');
        }

        currentProduct = await response.json();
        displayProductDetails();
        await loadSimilarProducts();

    } catch (error) {
        console.error('Błąd ładowania produktu:', error);
        showError('Nie udało się załadować produktu. Spróbuj ponownie później.');
    } finally {
        showLoading(false);
    }
}

// ==================== WYŚWIETLANIE SZCZEGÓŁÓW ====================
function displayProductDetails() {
    const container = document.querySelector('.product-details-container');
    if (!container) return;

    const imageUrl = currentProduct.imageBase64
        ? `data:image/jpeg;base64,${currentProduct.imageBase64}`
        : 'assets/default-product.jpg';

    const categoryName = getCategoryName(currentProduct.category);
    const isOwner = currentUser && currentUser.id === currentProduct.sellerId;
    const canBuy = currentUser && !isOwner && currentProduct.available && currentProduct.stock > 0;

    container.innerHTML = `
        <div class="product-details-wrapper">
            <div class="product-details-left">
                <div class="product-image-main">
                    <img src="${imageUrl}" alt="${currentProduct.name}">
                    ${!currentProduct.available ? '<div class="product-badge unavailable">Niedostępny</div>' : ''}
                    ${currentProduct.stock === 0 ? '<div class="product-badge out-of-stock">Brak w magazynie</div>' : ''}
                </div>
            </div>

            <div class="product-details-right">
                <div class="product-category-badge">${categoryName}</div>
                <h1 class="product-name">${currentProduct.name}</h1>
                
                <div class="product-rating-section">
                    ${currentProduct.reviewCount > 0 ? `
                        <div class="rating-stars">
                            ${renderStars(currentProduct.rating)}
                            <span class="rating-text">${currentProduct.rating.toFixed(1)}/5</span>
                            <span class="review-count">(${currentProduct.reviewCount} opinii)</span>
                        </div>
                    ` : '<p class="no-reviews">Brak opinii</p>'}
                </div>

                <div class="product-price-section">
                    <div class="product-price-main">${currentProduct.price.toFixed(2)} PLN</div>
                    ${currentProduct.weight ? `
                        <div class="product-unit">za ${currentProduct.weight} ${currentProduct.weightUnit}</div>
                    ` : ''}
                </div>

                <div class="product-info-grid">
                    <div class="info-item">
                        <i class="fas fa-boxes"></i>
                        <div>
                            <span class="info-label">Dostępność:</span>
                            <span class="info-value ${currentProduct.stock === 0 ? 'text-danger' : currentProduct.stock < 5 ? 'text-warning' : 'text-success'}">
                                ${currentProduct.stock === 0 ? 'Brak w magazynie' : currentProduct.stock < 5 ? `Ostatnie ${currentProduct.stock} szt.` : `${currentProduct.stock} szt.`}
                            </span>
                        </div>
                    </div>
                    ${currentProduct.location ? `
                        <div class="info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <div>
                                <span class="info-label">Lokalizacja:</span>
                                <span class="info-value">${currentProduct.location}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>

<div class="seller-info">
    <div class="seller-info-header">
        <i class="fas fa-user-circle"></i>
        <span>Sprzedawca</span>
    </div>
    <div class="seller-info-content">
        <div class="seller-name">${currentProduct.sellerFirstname} ${currentProduct.sellerLastname}</div>
        <div class="seller-email">
            <i class="fas fa-envelope"></i>
            <span>${currentProduct.sellerEmail}</span>
        </div>
    </div>
</div>

                ${canBuy ? `
                    <div class="purchase-section">
                        <h3>Kup produkt</h3>
                        <div class="quantity-selector">
                            <label for="quantity">Ilość:</label>
                            <div class="quantity-controls">
                                <button type="button" class="qty-btn" onclick="changeQuantity(-1)">-</button>
                                <input type="number" id="quantity" value="1" min="1" max="${currentProduct.stock}" />
                                <button type="button" class="qty-btn" onclick="changeQuantity(1)">+</button>
                            </div>
                            <span class="total-price">Razem: <strong id="total-price">${currentProduct.price.toFixed(2)} PLN</strong></span>
                        </div>

                        <div class="form-group">
                            <label for="delivery-address">Adres dostawy:</label>
                            <input type="text" id="delivery-address" class="form-control" placeholder="ul. Przykładowa 1, 00-001 Warszawa" required>
                        </div>

                        <div class="form-group">
                            <label for="buyer-notes">Uwagi dla sprzedawcy (opcjonalnie):</label>
                            <textarea id="buyer-notes" class="form-control" rows="3" placeholder="Np. proszę o kontakt przed dostawą"></textarea>
                        </div>
<button class="btn btn-outline btn-block" onclick="contactSeller()" style="margin-bottom: 15px;">
    <i class="fas fa-comments"></i>
    Skontaktuj się ze sprzedawcą
</button>
                        <button class="btn btn-primary btn-large btn-buy" onclick="buyProduct()">
                            <i class="fas fa-shopping-cart"></i> Kup teraz
                        </button>

                        <p class="balance-info">Twoje saldo: <strong id="user-balance">${currentUser ? currentUser.balance.toFixed(2) : '0.00'} PLN</strong></p>
                    </div>
                ` : isOwner ? `
                    <div class="owner-section">
                        <p class="info-message"><i class="fas fa-info-circle"></i> To jest Twój produkt</p>
                        <a href="profile.html?tab=products" class="btn btn-secondary">
                            <i class="fas fa-edit"></i> Zarządzaj produktem
                        </a>
                    </div>
                ` : !currentUser ? `
                    <div class="login-prompt">
                        <p><i class="fas fa-sign-in-alt"></i> Zaloguj się, aby kupić ten produkt</p>
                        <a href="login.html" class="btn btn-primary">Zaloguj się</a>
                    </div>
                ` : `
                    <div class="unavailable-section">
                        <p class="error-message"><i class="fas fa-exclamation-circle"></i> Produkt jest obecnie niedostępny</p>
                    </div>
                `}
            </div>
        </div>

        <div class="product-description-section">
            <h2>Opis produktu</h2>
            <p>${currentProduct.description || 'Brak opisu produktu.'}</p>
        </div>
    `;

    // Aktualizuj ilość przy zmianie
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', updateTotalPrice);
    }
}

// ==================== ZAKUP PRODUKTU ====================
async function buyProduct() {
    if (!currentUser) {
        alert('Musisz być zalogowany, aby kupić produkt');
        window.location.href = 'login.html';
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value);
    const deliveryAddress = document.getElementById('delivery-address').value.trim();
    const buyerNotes = document.getElementById('buyer-notes').value.trim();

    // Walidacja
    if (!deliveryAddress) {
        showNotification('Podaj adres dostawy', 'error');
        return;
    }

    if (quantity < 1 || quantity > currentProduct.stock) {
        showNotification('Nieprawidłowa ilość', 'error');
        return;
    }

    const totalPrice = currentProduct.price * quantity;
    if (currentUser.balance < totalPrice) {
        showNotification(`Niewystarczające środki. Potrzebujesz ${totalPrice.toFixed(2)} PLN, masz ${currentUser.balance.toFixed(2)} PLN`, 'error');
        return;
    }

    // Potwierdzenie
    if (!confirm(`Czy na pewno chcesz kupić ${quantity} szt. za ${totalPrice.toFixed(2)} PLN?`)) {
        return;
    }

    try {
        const buyBtn = document.querySelector('.btn-buy');
        buyBtn.disabled = true;
        buyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Przetwarzanie...';

        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                productId: currentProduct.id,
                quantity: quantity,
                deliveryAddress: deliveryAddress,
                buyerNotes: buyerNotes || null
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się złożyć zamówienia');
        }

        const order = await response.json();

        showNotification('Zakup zakończony pomyślnie! Sprawdź historię zakupów.', 'success');

        // Przekieruj do historii zakupów po 2 sekundach
        setTimeout(() => {
            window.location.href = 'profile.html?tab=bought-products';
        }, 2000);

    } catch (error) {
        console.error('Błąd zakupu:', error);
        showNotification(error.message, 'error');

        const buyBtn = document.querySelector('.btn-buy');
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Kup teraz';
        }
    }
}

// ==================== PODOBNE PRODUKTY ====================
async function loadSimilarProducts() {
    try {
        const response = await fetch(`${API_BASE}/products/category/${currentProduct.category}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) return;

        const products = await response.json();
        const similarProducts = products
            .filter(p => p.id !== currentProduct.id)
            .slice(0, 4);

        displaySimilarProducts(similarProducts);

    } catch (error) {
        console.error('Błąd ładowania podobnych produktów:', error);
    }
}

function displaySimilarProducts(products) {
    const container = document.querySelector('.similar-products-grid');
    if (!container || products.length === 0) return;

    container.innerHTML = products.map(product => {
        const imageUrl = product.imageBase64
            ? `data:image/jpeg;base64,${product.imageBase64}`
            : 'assets/default-product.jpg';

        return `
            <div class="product-card-small" onclick="window.location.href='product-details.html?id=${product.id}'">
                <img src="${imageUrl}" alt="${product.name}">
                <div class="card-info">
                    <h4>${product.name}</h4>
                    <p class="price">${product.price.toFixed(2)} PLN</p>
                    ${product.reviewCount > 0 ? `
                        <div class="rating">
                            <i class="fas fa-star"></i> ${product.rating.toFixed(1)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== POMOCNICZE FUNKCJE ====================
function changeQuantity(delta) {
    const input = document.getElementById('quantity');
    let value = parseInt(input.value) + delta;
    value = Math.max(1, Math.min(value, currentProduct.stock));
    input.value = value;
    updateTotalPrice();
}
// ==================== KONTAKT ZE SPRZEDAWCĄ ====================
async function contactSeller() {
    if (!currentProduct) {
        showNotification('Nie znaleziono produktu', 'error');
        return;
    }

    if (!currentUser) {
        showNotification('Musisz być zalogowany, aby wysłać wiadomość', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // Sprawdź czy to nie własny produkt
    if (currentProduct.sellerId === currentUser.id) {
        showNotification('To jest Twój własny produkt', 'info');
        return;
    }

    try {
        showNotification('Przekierowuję do czatu...', 'info');

        // Rozpocznij konwersację ze sprzedawcą
        const response = await fetch(`${API_BASE}/chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                otherUserId: currentProduct.sellerId,
                initialMessage: `Witam! Interesuje mnie Twój produkt: ${currentProduct.name}`
            })
        });

        if (!response.ok) {
            // Jeśli konwersacja już istnieje, sprawdź czy otrzymujemy jej ID
            const error = await response.json();
            if (response.status === 400 && error.id) {
                // Konwersacja już istnieje, przekieruj do niej
                window.location.href = `chat.html?conversation=${error.id}`;
                return;
            }
            throw new Error(error.error || 'Nie udało się rozpocząć konwersacji');
        }

        const conversation = await response.json();

        // Przekieruj do czatu z tą konwersacją
        window.location.href = `chat.html?conversation=${conversation.id}`;

    } catch (error) {
        console.error('Błąd kontaktu ze sprzedawcą:', error);
        showNotification(error.message, 'error');
    }
}

function updateTotalPrice() {
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const total = currentProduct.price * quantity;
    const totalPriceElement = document.getElementById('total-price');
    if (totalPriceElement) {
        totalPriceElement.textContent = `${total.toFixed(2)} PLN`;
    }
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let starsHTML = '';

    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
        starsHTML += '<i class="far fa-star"></i>';
    }

    return starsHTML;
}

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

async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/user`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.log('Użytkownik niezalogowany');
    }
}

function showLoading(show) {
    const container = document.querySelector('.product-details-container');
    if (show && container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div class="spinner"></div>
                <p style="color: #999; margin-top: 20px;">Ładowanie produktu...</p>
            </div>
        `;
    }
}

function showError(message) {
    const container = document.querySelector('.product-details-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 64px; color: #ff6b6b; margin-bottom: 20px;"></i>
                <h3 style="color: #666; margin-bottom: 10px;">Wystąpił błąd</h3>
                <p style="color: #999;">${message}</p>
                <a href="marketplace.html" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-arrow-left"></i> Wróć do marketplace
                </a>
            </div>
        `;
    }
}

function showNotification(message, type = 'info') {
    // Usuń poprzednie powiadomienie jeśli istnieje
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
    }, 5000);
}

function setupEventListeners() {
    // Event listeners są dodawane dynamicznie w displayProductDetails
}

// CSS dla product details
const style = document.createElement('style');
style.textContent = `
    .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid var(--primary);
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
    
    .notification-success {
        border-left: 4px solid #28a745;
    }
    
    .notification-error {
        border-left: 4px solid #dc3545;
    }
    
    .notification-info {
        border-left: 4px solid #17a2b8;
    }
    
    .notification-toast i {
        font-size: 20px;
    }
    
    .notification-success i {
        color: #28a745;
    }
    
    .notification-error i {
        color: #dc3545;
    }
    
    .notification-info i {
        color: #17a2b8;
    }
    
    .btn-large {
        padding: 14px 28px;
        font-size: 16px;
        width: 100%;
    }
    
    .quantity-controls {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .qty-btn {
        width: 36px;
        height: 36px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
    }
    
    .qty-btn:hover {
        background: #f5f5f5;
    }
    
    #quantity {
        width: 80px;
        text-align: center;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    .total-price {
        margin-left: 20px;
        font-size: 16px;
    }
    
    .text-danger {
        color: #dc3545;
    }
    
    .text-warning {
        color: #ffa500;
    }
    
    .text-success {
        color: #28a745;
    }
    
    .balance-info {
        margin-top: 15px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        text-align: center;
    }
`;
document.head.appendChild(style);