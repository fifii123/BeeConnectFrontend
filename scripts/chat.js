// scripts/chat.js - Integracja czatu z API

const API_BASE = 'http://localhost:8080/api';

let currentConversationId = null;
let currentUser = null;
let conversations = [];
let messages = [];
let messagePollingInterval = null;
let isInitialLoad = true; // Flaga dla pierwszego ładowania

// ==================== INICJALIZACJA ====================
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    await loadConversations();
    setupEventListeners();
    setupMobileHandlers();

    // Sprawdź czy jest parametr conversation w URL
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    if (conversationId) {
        await openConversation(parseInt(conversationId));
    }
});

// ==================== AUTENTYKACJA ====================
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/user`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = await response.json();
            updateWelcomeMessage();
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Błąd autoryzacji:', error);
        window.location.href = 'login.html';
    }
}

function updateWelcomeMessage() {
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg && currentUser) {
        welcomeMsg.textContent = `Witaj, ${currentUser.firstname}!`;
    }
}

// ==================== ŁADOWANIE KONWERSACJI ====================
async function loadConversations() {
    try {
        // Tylko przy pierwszym ładowaniu pokazuj spinner
        if (isInitialLoad) {
            showConversationsLoading(true);
        }

        const response = await fetch(`${API_BASE}/chat/conversations`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Nie udało się pobrać konwersacji');
        }

        const newConversations = await response.json();

        // Sprawdź czy są jakieś zmiany
        if (JSON.stringify(conversations) !== JSON.stringify(newConversations)) {
            conversations = newConversations;
            displayConversations();
        }

    } catch (error) {
        console.error('Błąd ładowania konwersacji:', error);
        if (isInitialLoad) {
            showConversationsError('Nie udało się załadować konwersacji');
        }
    } finally {
        if (isInitialLoad) {
            showConversationsLoading(false);
            isInitialLoad = false;
        }
    }
}

function displayConversations() {
    const container = document.querySelector('.conversation-list');
    if (!container) return;

    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>Brak konwersacji</p>
                <p style="font-size: 13px; color: #999;">Rozpocznij nową rozmowę z użytkownikiem</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => createConversationItem(conv)).join('');
    attachConversationListeners();

    // Jeśli jest aktywna konwersacja, zaznacz ją
    if (currentConversationId) {
        const activeItem = document.querySelector(`[data-conversation="${currentConversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

function createConversationItem(conv) {
    const time = formatConversationTime(conv.lastMessageAt);
    const preview = conv.lastMessageContent || 'Brak wiadomości';
    const unreadBadge = conv.unreadCount > 0 ?
        `<div class="conversation-badge">${conv.unreadCount}</div>` : '';

    return `
        <div class="conversation-item" data-conversation="${conv.id}">
            <div class="conversation-avatar">
                <img src="assets/default-avatar.png" alt="${conv.otherUserFirstname} ${conv.otherUserLastname}">
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.otherUserFirstname} ${conv.otherUserLastname}</div>
                <div class="conversation-preview">${truncateText(preview, 50)}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${time}</div>
                ${unreadBadge}
            </div>
        </div>
    `;
}

function attachConversationListeners() {
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', function() {
            const convId = parseInt(this.getAttribute('data-conversation'));
            openConversation(convId);
        });
    });
}

// ==================== OTWIERANIE KONWERSACJI ====================
async function openConversation(conversationId) {
    currentConversationId = conversationId;

    // Aktualizuj UI - zaznacz aktywną konwersację
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`[data-conversation="${conversationId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // Usuń badge nieprzeczytanych
        const badge = activeItem.querySelector('.conversation-badge');
        if (badge) badge.remove();
    }

    // Na mobile - ukryj listę, pokaż czat
    if (window.innerWidth < 768) {
        document.getElementById('conversations-list').classList.add('hidden');
        document.getElementById('chat-main').classList.remove('hidden');
    }

    // Resetuj flagę pierwszego ładowania dla wiadomości
    messages = [];

    // Załaduj wiadomości
    await loadMessages(conversationId, true);

    // Oznacz jako przeczytane
    await markAsRead(conversationId);

    // Zaktualizuj header czatu
    updateChatHeader(conversationId);

    // Start polling dla nowych wiadomości
    startMessagePolling();
}

function updateChatHeader(conversationId) {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const headerName = document.querySelector('.chat-header-name');
    const headerStatus = document.querySelector('.chat-header-status');

    if (headerName) {
        headerName.textContent = `${conv.otherUserFirstname} ${conv.otherUserLastname}`;
    }

    if (headerStatus) {
        headerStatus.textContent = 'Online';
        headerStatus.classList.add('online');
    }
}

// ==================== ŁADOWANIE WIADOMOŚCI ====================
async function loadMessages(conversationId, showLoading = false) {
    try {
        // Tylko przy pierwszym załadowaniu pokazuj loading
        if (showLoading) {
            showMessagesLoading(true);
        }

        const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Nie udało się pobrać wiadomości');
        }

        const newMessages = await response.json();

        // Sprawdź czy są nowe wiadomości
        const oldMessagesLength = messages.length;
        const hasNewMessages = newMessages.length !== oldMessagesLength;

        if (hasNewMessages || showLoading) {
            // Zachowaj pozycję scrolla jeśli to nie jest nowa wiadomość na końcu
            const container = document.getElementById('chat-messages');
            const wasAtBottom = container &&
                (container.scrollHeight - container.scrollTop - container.clientHeight < 50);

            messages = newMessages;
            displayMessages();

            // Scroll do dołu tylko jeśli użytkownik był na dole lub to nowa wiadomość
            if (wasAtBottom || newMessages.length > oldMessagesLength) {
                scrollToBottom();
            }
        }

    } catch (error) {
        console.error('Błąd ładowania wiadomości:', error);
        if (showLoading) {
            showMessagesError('Nie udało się załadować wiadomości');
        }
    } finally {
        if (showLoading) {
            showMessagesLoading(false);
        }
    }
}

function displayMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="message-date-divider">
                <span>Brak wiadomości</span>
            </div>
            <div style="text-align: center; padding: 40px 20px; color: #999;">
                <i class="fas fa-comment-slash" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                <p>Napisz pierwszą wiadomość!</p>
            </div>
        `;
        return;
    }

    // Grupuj wiadomości według dat
    const groupedMessages = groupMessagesByDate(messages);

    let html = '';
    for (const [date, msgs] of Object.entries(groupedMessages)) {
        html += `
            <div class="message-date-divider">
                <span>${date}</span>
            </div>
        `;

        msgs.forEach(msg => {
            html += createMessageElement(msg);
        });
    }

    container.innerHTML = html;
}

function createMessageElement(msg) {
    const messageClass = msg.isMine ? 'message-sent' : 'message-received';
    const time = formatMessageTime(msg.sentAt);

    // Dodaj status przeczytania tylko dla wysłanych wiadomości
    let readStatus = '';
    if (msg.isMine) {
        if (msg.isRead) {
            readStatus = '<span class="message-status read" title="Przeczytane"><i class="fas fa-check-double"></i></span>';
        } else {
            readStatus = '<span class="message-status sent" title="Wysłane"><i class="fas fa-check"></i></span>';
        }
    }

    return `
        <div class="message ${messageClass}">
            <div class="message-bubble">
                <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
            <div class="message-time">${time} ${readStatus}</div>
        </div>
    `;
}

function groupMessagesByDate(messages) {
    const grouped = {};

    messages.forEach(msg => {
        const date = formatDateDivider(msg.sentAt);
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(msg);
    });

    return grouped;
}

// ==================== WYSYŁANIE WIADOMOŚCI ====================
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();

    if (!content || !currentConversationId) return;

    // Wyłącz przycisk i input podczas wysyłania
    const sendBtn = document.getElementById('send-message');
    input.disabled = true;
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/chat/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                conversationId: currentConversationId,
                content: content
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się wysłać wiadomości');
        }

        const newMessage = await response.json();

        // Dodaj wiadomość do listy
        messages.push(newMessage);

        // Dodaj wiadomość do UI z animacją
        const container = document.getElementById('chat-messages');
        const messageHtml = createMessageElement(newMessage);
        container.insertAdjacentHTML('beforeend', messageHtml);

        // Wyczyść input
        input.value = '';

        // Scroll do dołu
        scrollToBottom();

        // Zaktualizuj konwersacje (ostatnia wiadomość) - ale bez pokazywania loadingu
        await loadConversations();

    } catch (error) {
        console.error('Błąd wysyłania wiadomości:', error);
        showNotification(error.message, 'error');
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ==================== OZNACZANIE JAKO PRZECZYTANE ====================
async function markAsRead(conversationId) {
    try {
        await fetch(`${API_BASE}/chat/conversations/${conversationId}/read`, {
            method: 'PUT',
            credentials: 'include'
        });

        // Po oznaczeniu jako przeczytane, odśwież wiadomości aby zaktualizować statusy
        setTimeout(() => {
            if (currentConversationId === conversationId) {
                loadMessages(conversationId, false);
            }
        }, 500);
    } catch (error) {
        console.error('Błąd oznaczania jako przeczytane:', error);
    }
}

// ==================== POLLING NOWYCH WIADOMOŚCI ====================
function startMessagePolling() {
    stopMessagePolling();

    messagePollingInterval = setInterval(async () => {
        if (currentConversationId) {
            // Ładuj bez pokazywania loadingu
            await loadMessages(currentConversationId, false);
            await loadConversations();
        }
    }, 3000); // Co 3 sekundy
}

function stopMessagePolling() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Wysyłanie wiadomości
    const sendBtn = document.getElementById('send-message');
    const input = document.getElementById('chat-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Wyszukiwanie konwersacji
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filterConversations);
    }
}

function setupMobileHandlers() {
    const backBtn = document.getElementById('back-to-conversations');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            document.getElementById('conversations-list').classList.remove('hidden');
            document.getElementById('chat-main').classList.add('hidden');
            stopMessagePolling();
        });
    }

    window.addEventListener('resize', adjustLayout);
    adjustLayout();
}

function adjustLayout() {
    if (window.innerWidth < 768) {
        if (currentConversationId) {
            document.getElementById('conversations-list').classList.add('hidden');
            document.getElementById('chat-main').classList.remove('hidden');
        } else {
            document.getElementById('conversations-list').classList.remove('hidden');
            document.getElementById('chat-main').classList.add('hidden');
        }
    } else {
        document.getElementById('conversations-list').classList.remove('hidden');
        document.getElementById('chat-main').classList.remove('hidden');
    }
}

// ==================== FILTROWANIE KONWERSACJI ====================
function filterConversations() {
    const searchQuery = document.querySelector('.search-input').value.toLowerCase();

    document.querySelectorAll('.conversation-item').forEach(item => {
        const name = item.querySelector('.conversation-name').textContent.toLowerCase();
        const preview = item.querySelector('.conversation-preview').textContent.toLowerCase();

        if (name.includes(searchQuery) || preview.includes(searchQuery)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==================== POMOCNICZE FUNKCJE ====================
function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

function formatConversationTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Wczoraj';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('pl-PL', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' });
    }
}

function formatMessageTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Dzisiaj';
    } else if (diffDays === 1) {
        return 'Wczoraj';
    } else {
        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showConversationsLoading(show) {
    const container = document.querySelector('.conversation-list');
    if (show && container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="spinner"></div>
                <p style="color: #999; margin-top: 15px;">Ładowanie konwersacji...</p>
            </div>
        `;
    }
}

function showConversationsError(message) {
    const container = document.querySelector('.conversation-list');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ff6b6b; margin-bottom: 15px;"></i>
                <p style="color: #666;">${message}</p>
                <button class="btn btn-primary" onclick="loadConversations()" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Spróbuj ponownie
                </button>
            </div>
        `;
    }
}

function showMessagesLoading(show) {
    const container = document.getElementById('chat-messages');
    if (show && container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="spinner"></div>
                <p style="color: #999; margin-top: 15px;">Ładowanie wiadomości...</p>
            </div>
        `;
    }
}

function showMessagesError(message) {
    const container = document.getElementById('chat-messages');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ff6b6b; margin-bottom: 15px;"></i>
                <p style="color: #666;">${message}</p>
            </div>
        `;
    }
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

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS dla spinner, notyfikacji i statusów przeczytania
const style = document.createElement('style');
style.textContent = `
    .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid var(--primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #999;
    }

    .empty-state i {
        font-size: 64px;
        color: #ddd;
        margin-bottom: 20px;
    }

    .notification-toast {
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 15px 20px;
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

    .notification-toast.notification-success {
        border-left: 4px solid #4caf50;
    }

    .notification-toast.notification-error {
        border-left: 4px solid #f44336;
    }

    .notification-toast.notification-info {
        border-left: 4px solid #2196f3;
    }

    .notification-toast i {
        font-size: 20px;
    }

    .notification-success i {
        color: #4caf50;
    }

    .notification-error i {
        color: #f44336;
    }

    .notification-info i {
        color: #2196f3;
    }

    /* Statusy przeczytania wiadomości */
    .message-status {
        display: inline-flex;
        align-items: center;
        margin-left: 5px;
        font-size: 10px;
    }

    .message-status.sent {
        color: #999;
    }

    .message-status.read {
        color: #34B7F1;
    }

    .message-status i {
        font-size: 12px;
    }

    /* Animacja pojawienia się */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .message:last-child {
        animation: fadeInUp 0.3s ease;
    }
`;
document.head.appendChild(style);