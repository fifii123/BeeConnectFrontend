
const API_BASE = 'http://localhost:8080/api';

let notifications = [];
let unreadCount = 0;
let notificationPollingInterval = null;

// ==================== INICJALIZACJA ====================
function initNotifications() {
    loadNotifications();
    setupNotificationListeners();
    startNotificationPolling();
}

// ==================== ŁADOWANIE POWIADOMIEŃ ====================
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE}/notifications`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            notifications = await response.json();
            updateNotificationUI();
        }
    } catch (error) {
        console.error('Błąd ładowania powiadomień:', error);
    }
}

async function loadUnreadCount() {
    try {
        const response = await fetch(`${API_BASE}/notifications/unread/count`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            unreadCount = data.count;
            updateBadge();
        }
    } catch (error) {
        console.error('Błąd ładowania liczby nieprzeczytanych:', error);
    }
}

// ==================== AKTUALIZACJA UI ====================
function updateNotificationUI() {
    updateBadge();
    displayNotifications();
}

function updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function displayNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <p>Brak powiadomień</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map(notif => createNotificationItem(notif)).join('');
}

function createNotificationItem(notif) {
    const icon = getNotificationIcon(notif.type);
    const time = formatNotificationTime(notif.createdAt);
    const unreadClass = notif.isRead ? '' : 'notification-unread';

    return `
        <div class="notification-item ${unreadClass}" data-id="${notif.id}" data-url="${notif.actionUrl || '#'}">
            <div class="notification-icon ${notif.type.toLowerCase()}">
                <i class="${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notif.title}</div>
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${time}</div>
            </div>
            <button class="notification-delete" onclick="deleteNotification(${notif.id}, event)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function getNotificationIcon(type) {
    const icons = {
        'BEEKEEPER_VERIFIED': 'fas fa-check-circle',
        'BEEKEEPER_REJECTED': 'fas fa-times-circle',
        'AREA_RESERVED': 'fas fa-map-marked-alt',
        'RESERVATION_CONFIRMED': 'fas fa-calendar-check',
        'RESERVATION_CANCELLED': 'fas fa-calendar-times',
        'NEW_MESSAGE': 'fas fa-envelope',
        'NEW_ORDER': 'fas fa-shopping-cart',
        'ORDER_SHIPPED': 'fas fa-shipping-fast',
        'PRODUCT_REVIEW': 'fas fa-star',
        'SYSTEM': 'fas fa-info-circle'
    };
    return icons[type] || 'fas fa-bell';
}

// ==================== OBSŁUGA POWIADOMIEŃ ====================
async function markAsRead(notificationId) {
    try {
        await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
            method: 'PUT',
            credentials: 'include'
        });

        // Znajdź powiadomienie i oznacz jako przeczytane
        const notif = notifications.find(n => n.id === notificationId);
        if (notif) {
            notif.isRead = true;
            unreadCount = Math.max(0, unreadCount - 1);
            updateNotificationUI();
        }
    } catch (error) {
        console.error('Błąd oznaczania jako przeczytane:', error);
    }
}

async function markAllAsRead() {
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'PUT',
            credentials: 'include'
        });

        notifications.forEach(n => n.isRead = true);
        unreadCount = 0;
        updateNotificationUI();
    } catch (error) {
        console.error('Błąd oznaczania wszystkich jako przeczytane:', error);
    }
}

async function deleteNotification(notificationId, event) {
    if (event) {
        event.stopPropagation();
    }

    try {
        await fetch(`${API_BASE}/notifications/${notificationId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        // Usuń z listy
        const notif = notifications.find(n => n.id === notificationId);
        if (notif && !notif.isRead) {
            unreadCount = Math.max(0, unreadCount - 1);
        }

        notifications = notifications.filter(n => n.id !== notificationId);
        updateNotificationUI();
    } catch (error) {
        console.error('Błąd usuwania powiadomienia:', error);
    }
}

// ==================== OTWIERANIE POWIADOMIENIA ====================
function openNotification(notificationId, url) {
    markAsRead(notificationId);

    if (url && url !== '#') {
        window.location.href = url;
    }
}

// ==================== EVENT LISTENERS ====================
function setupNotificationListeners() {
    // Toggle dropdown
    const bellIcon = document.getElementById('notification-bell');
    if (bellIcon) {
        bellIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationDropdown();
        });
    }

    // Oznacz wszystkie jako przeczytane
    const markAllBtn = document.getElementById('mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllAsRead();
        });
    }

    // Kliknięcie w powiadomienie
    document.addEventListener('click', (e) => {
        const notifItem = e.target.closest('.notification-item');
        if (notifItem) {
            const id = parseInt(notifItem.dataset.id);
            const url = notifItem.dataset.url;
            openNotification(id, url);
        }
    });

    // Zamknij dropdown po kliknięciu poza nim
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notification-dropdown');
        const bellIcon = document.getElementById('notification-bell');

        if (dropdown && !dropdown.contains(e.target) && !bellIcon.contains(e.target)) {
            closeNotificationDropdown();
        }
    });
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function closeNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// ==================== POLLING ====================
function startNotificationPolling() {
    // Sprawdzaj co 30 sekund
    notificationPollingInterval = setInterval(() => {
        loadUnreadCount();
    }, 30000);

    // Pierwsze wywołanie
    loadUnreadCount();
}

function stopNotificationPolling() {
    if (notificationPollingInterval) {
        clearInterval(notificationPollingInterval);
    }
}

// ==================== FORMATOWANIE CZASU ====================
function formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Teraz';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays === 1) return 'Wczoraj';
    if (diffDays < 7) return `${diffDays} dni temu`;

    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

// Eksportuj funkcje
window.initNotifications = initNotifications;
window.deleteNotification = deleteNotification;