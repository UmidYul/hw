// ========================================
// AURA Admin Panel - Validators
// Form validation utilities
// ========================================

const Validators = {
    // Required field
    required(value, fieldName = 'Поле') {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return { valid: false, message: `${fieldName} обязательно для заполнения` };
        }
        return { valid: true };
    },

    // Email validation
    email(value) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value)) {
            return { valid: false, message: 'Некорректный email' };
        }
        return { valid: true };
    },

    // URL validation
    url(value) {
        try {
            new URL(value);
            return { valid: true };
        } catch {
            return { valid: false, message: 'Некорректный URL' };
        }
    },

    // Min/max length
    length(value, min, max) {
        const len = value.length;
        if (min && len < min) {
            return { valid: false, message: `Минимум ${min} символов` };
        }
        if (max && len > max) {
            return { valid: false, message: `Максимум ${max} символов` };
        }
        return { valid: true };
    },

    // Number range
    range(value, min, max) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return { valid: false, message: 'Должно быть числом' };
        }
        if (min !== undefined && num < min) {
            return { valid: false, message: `Минимум ${min}` };
        }
        if (max !== undefined && num > max) {
            return { valid: false, message: `Максимум ${max}` };
        }
        return { valid: true };
    },

    // SKU format (alphanumeric, dash, underscore)
    sku(value) {
        const regex = /^[A-Z0-9_-]+$/i;
        if (!regex.test(value)) {
            return { valid: false, message: 'SKU может содержать только буквы, цифры, дефис и подчеркивание' };
        }
        return { valid: true };
    },

    // Slug format (lowercase, dash)
    slug(value) {
        const regex = /^[a-z0-9-]+$/;
        if (!regex.test(value)) {
            return { valid: false, message: 'Slug может содержать только строчные буквы, цифры и дефис' };
        }
        return { valid: true };
    },

    // Phone number (simple validation)
    phone(value) {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length < 10) {
            return { valid: false, message: 'Некорректный номер телефона' };
        }
        return { valid: true };
    },

    // Validate form
    validateForm(formId, rules) {
        const form = document.getElementById(formId);
        if (!form) return { valid: false, errors: {} };

        const errors = {};
        let isValid = true;

        Object.keys(rules).forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!field) return;

            const value = field.value;
            const fieldRules = rules[fieldName];

            for (let rule of fieldRules) {
                const result = rule.validator(value);
                if (!result.valid) {
                    errors[fieldName] = result.message;
                    isValid = false;

                    // Add error class
                    field.classList.add('error');

                    // Show error message
                    let errorEl = field.parentElement.querySelector('.form-error');
                    if (!errorEl) {
                        errorEl = document.createElement('div');
                        errorEl.className = 'form-error';
                        field.parentElement.appendChild(errorEl);
                    }
                    errorEl.textContent = result.message;

                    break;
                } else {
                    // Remove error
                    field.classList.remove('error');
                    const errorEl = field.parentElement.querySelector('.form-error');
                    if (errorEl) errorEl.remove();
                }
            }
        });

        return { valid: isValid, errors };
    },

    // Clear form errors
    clearErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.remove());
    }
};

// Make globally available
window.Validators = Validators;
