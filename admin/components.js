// ========================================
// Higher Waist Admin Panel - Components
// Reusable UI Components
// ========================================

const normalizeCurrencySymbol = (symbol) => {
    if (!symbol) return 'Сумм';
    const value = String(symbol).trim();
    const lower = value.toLowerCase();
    if (lower.includes('руб') || lower.includes('rub') || value.includes('₽') || value === 'RUB') {
        return 'Сумм';
    }
    return value;
};

const Components = {
    // Toast notifications
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'OK',
            error: 'ERR',
            warning: 'WARN',
            info: 'INFO'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">X</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Confirm modal
    confirm(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                    <button class="btn btn-error" id="confirm-btn">Подтвердить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#confirm-btn').addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });
    },

    // Format price
    formatPrice(price) {
        const rawSymbol = (typeof REPO !== 'undefined' && REPO.getSettings)
            ? REPO.getSettings().currencySymbol
            : 'Сумм';
        const currencySymbol = normalizeCurrencySymbol(rawSymbol);
        return price.toLocaleString('ru-RU') + ' ' + currencySymbol;
    },

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Render table
    renderTable(config) {
        const {
            data,
            columns,
            actions,
            selectable,
            emptyMessage = 'Нет данных'
        } = config;

        if (!data || data.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">Нет</div>
                    <div class="empty-state-title">${emptyMessage}</div>
                </div>
            `;
        }

        let html = '<div class="table-container"><table class="table"><thead><tr>';

        if (selectable) {
            html += '<th><input type="checkbox" id="select-all"></th>';
        }

        columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });

        if (actions) {
            html += '<th>Действия</th>';
        }

        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';

            if (selectable) {
                html += `<td><input type="checkbox" class="row-select" value="${row.id}"></td>`;
            }

            columns.forEach(col => {
                const value = col.render ? col.render(row) : row[col.field];
                html += `<td>${value}</td>`;
            });

            if (actions) {
                html += '<td><div class="flex gap-md">';
                actions.forEach(action => {
                    html += `<button class="btn btn-sm btn-ghost" onclick="${action.handler}('${row.id}')">${action.label}</button>`;
                });
                html += '</div></td>';
            }

            html += '</tr>';
        });

        html += '</tbody></table></div>';

        return html;
    },

    // Pagination
    renderPagination(currentPage, totalPages, onPageChange) {
        if (totalPages <= 1) return '';

        let html = '<div class="pagination">';

        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">«</button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += '<span>...</span>';
            }
        }

        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">»</button>`;

        html += '</div>';

        return html;
    },

    // Status badge
    renderBadge(text, type = 'default') {
        return `<span class="badge badge-${type}">${text}</span>`;
    },

    // Skeleton loader
    showSkeleton(selector, lines = 5) {
        const container = document.querySelector(selector);
        if (!container) return;

        let html = '';
        for (let i = 0; i < lines; i++) {
            html += '<div class="skeleton skeleton-text"></div>';
        }

        container.innerHTML = html;
    }
};

// Make globally available
window.Components = Components;

const setupAdminSidebarToggle = () => {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (!toggle || !sidebar) return;

    if (toggle.dataset.bound === 'true') return;
    toggle.dataset.bound = 'true';

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
    });
};

const setupResponsiveTables = () => {
    const tables = document.querySelectorAll('table.table');
    if (!tables.length) return;

    const applyLabels = (table) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        if (!headers.length) return;

        table.querySelectorAll('tbody tr').forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td'));
            cells.forEach((cell, index) => {
                if (!cell.dataset.label && headers[index]) {
                    cell.dataset.label = headers[index];
                }
            });
        });
    };

    tables.forEach((table) => {
        applyLabels(table);

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const observer = new MutationObserver(() => applyLabels(table));
        observer.observe(tbody, { childList: true, subtree: true });
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupAdminSidebarToggle();
        setupResponsiveTables();
    });
} else {
    setupAdminSidebarToggle();
    setupResponsiveTables();
}
