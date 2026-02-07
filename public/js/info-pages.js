// Info pages loader
// Renders accordion content from API-managed data

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function initInfoPage(slug) {
    const contentEl = document.getElementById('infoContent');
    if (!contentEl) return;

    const titleEl = document.getElementById('infoTitle');
    const breadcrumbEl = document.getElementById('breadcrumbCurrent');
    const metaEl = document.getElementById('infoMeta');

    try {
        let page = null;

        if (typeof API !== 'undefined' && API.content?.getInfoPage) {
            page = await API.content.getInfoPage(slug);
        } else {
            const response = await fetch(`/api/content/pages/${encodeURIComponent(slug)}`);
            if (!response.ok) return;
            page = await response.json();
        }

        if (!page || !Array.isArray(page.sections)) return;

        if (titleEl && page.title) {
            titleEl.textContent = page.title;
        }

        if (breadcrumbEl && page.title) {
            breadcrumbEl.textContent = page.title;
        }

        if (metaEl) {
            if (page.meta) {
                metaEl.textContent = page.meta;
                metaEl.style.display = '';
            } else {
                metaEl.textContent = '';
                metaEl.style.display = 'none';
            }
        }

        contentEl.innerHTML = page.sections.map((section, index) => {
            const title = escapeHtml(section?.title || `Раздел ${index + 1}`);
            const body = section?.body || '';
            const open = index === 0 ? ' open' : '';
            return `
                <details class="accordion-item"${open}>
                    <summary>${title}</summary>
                    <div class="accordion-body">${body}</div>
                </details>
            `;
        }).join('');

        if (slug === 'contacts') {
            const phoneFooter = document.getElementById('contactPhone');
            const emailFooter = document.getElementById('contactEmail');
            const phoneInline = document.getElementById('contactPhoneInline');
            const emailInline = document.getElementById('contactEmailInline');

            if (phoneFooter && phoneInline) {
                phoneInline.textContent = phoneFooter.textContent || '—';
            }

            if (emailFooter && emailInline) {
                emailInline.textContent = emailFooter.textContent || '—';
            }
        }
    } catch (error) {
        console.error('Failed to load info page:', error);
    }
}

if (typeof window !== 'undefined') {
    window.initInfoPage = initInfoPage;
}
