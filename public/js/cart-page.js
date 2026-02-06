// Cart Page Logic

let cartSettings = {
    shippingCost: 0,
    freeShippingThreshold: 0,
    vatRate: 0
};

// Load cart settings
async function loadCartSettings() {
    try {
        if (typeof API !== 'undefined' && API.settings) {
            const settings = await API.settings.get();
            cartSettings.shippingCost = settings.shipping_cost || 0;
            cartSettings.freeShippingThreshold = settings.free_shipping_threshold || 0;
            cartSettings.vatRate = settings.vat_rate || 0;
        }
    } catch (error) {
        console.log('Using default cart settings');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load settings first
    await loadCartSettings();

    // Update delivery info text with settings
    const deliveryInfoText = document.getElementById('deliveryInfoText');
    if (deliveryInfoText && cartSettings.freeShippingThreshold > 0) {
        deliveryInfoText.textContent = `Бесплатная доставка от ${formatPrice(cartSettings.freeShippingThreshold)}`;
    } else if (deliveryInfoText && cartSettings.shippingCost > 0) {
        deliveryInfoText.textContent = `Стоимость доставки: ${formatPrice(cartSettings.shippingCost)}`;
    } else if (deliveryInfoText) {
        deliveryInfoText.textContent = 'Бесплатная доставка';
    }

    // Load discounts and products
    if (window.discountSystem) {
        await window.discountSystem.loadActiveDiscounts();
    }
    await loadProducts();

    renderCart();
    initializeCartPage();
});

async function renderCart() {
    let items = cart.getItems();
    items = clampCartQuantities(items);
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartContainer = document.querySelector('.cart-container');

    if (items.length === 0) {
        cartContainer.style.display = 'none';
        emptyCart.style.display = 'flex';
    } else {
        emptyCart.style.display = 'none';
        cartContainer.style.display = 'grid';

        // Apply discounts to cart items
        const itemsWithDiscounts = await applyDiscountsToCartItems(items);

        cartItems.innerHTML = itemsWithDiscounts.map(item => renderCartItem(item)).join('');

        // Attach event listeners
        attachCartItemListeners();

        // Update summary
        updateCartSummary();
    }
}

// Apply discounts to cart items
async function applyDiscountsToCartItems(items) {
    if (!window.discountSystem || !window.discountSystem.loaded) {
        return items;
    }

    const allProducts = typeof getProducts === 'function' ? getProducts() : products;

    return items.map(item => {
        // Find product
        const product = allProducts.find(p => p.id === item.id);
        if (!product) return item;

        // Apply discount
        const productWithDiscount = window.discountSystem.applyDiscounts(product);

        // Update item with discount info
        return {
            ...item,
            originalPrice: product.price, // Use original product price, not cart price
            price: productWithDiscount.finalPrice ?? product.price,
            appliedDiscount: productWithDiscount.appliedDiscount,
            discountAmount: productWithDiscount.discountAmount,
            discountPercent: productWithDiscount.discountPercent
        };
    });
}

function renderCartItem(item) {
    const hasDiscount = item.appliedDiscount && item.originalPrice && item.originalPrice > item.price;
    const variants = getProductVariants(item.id);
    const colors = getProductColors(item.id);
    const sizes = getProductSizes(item.id);
    const maxQty = getMaxQtyForItem(item);
    const effectiveMax = Math.max(1, maxQty);
    const controlsDisabled = maxQty <= 0;

    return `
        <div class="cart-item" data-key="${item.key}">
            <div class="cart-item-image" style="background-image: url('${item.image || item.images?.[0] || ''}'); background-size: cover; background-position: center;"></div>
            
            <div class="cart-item-details">
                <h3 class="cart-item-title">${item.title || item.name}</h3>
                ${hasDiscount ? `<div class="cart-item-discount-label" style="color: #e74c3c; font-size: 12px; margin-top: 4px;">
                    <i class="fas fa-tag"></i> Скидка ${item.discountPercent}%
                </div>` : ''}
                
                <div class="cart-item-options">
                    <div class="cart-item-option">
                        <label>Цвет:</label>
                        <select class="cart-item-select color-select" data-key="${item.key}">
                            ${colors.map(color => {
        const available = isColorAvailable(variants, color, item.size, item.color);
        return `<option value="${color}" ${color === item.color ? 'selected' : ''} ${available ? '' : 'disabled'}>${color}</option>`;
    }).join('')}
                        </select>
                    </div>
                    
                    <div class="cart-item-option">
                        <label>Размер:</label>
                        <select class="cart-item-select size-select" data-key="${item.key}">
                            ${sizes.map(size => {
        const available = isSizeAvailable(variants, size, item.color, item.size);
        return `<option value="${size}" ${size === item.size ? 'selected' : ''} ${available ? '' : 'disabled'}>${size}</option>`;
    }).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="cart-item-price">
                    ${hasDiscount ? `
                        <span class="price-old">${formatPrice(item.originalPrice)}</span>
                    ` : item.oldPrice ? `
                        <span class="price-old">${formatPrice(item.oldPrice)}</span>
                    ` : ''}
                    <span class="price-current">${formatPrice(item.price)}</span>
                </div>
            </div>
            
            <div class="cart-item-actions">
                <div class="quantity-selector">
                    <button class="qty-btn qty-minus" data-key="${item.key}" aria-label="Уменьшить" ${controlsDisabled ? 'disabled' : ''}>
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="qty-input" value="${item.quantity}" min="1" max="${effectiveMax}" data-key="${item.key}" ${controlsDisabled ? 'disabled' : ''}>
                    <button class="qty-btn qty-plus" data-key="${item.key}" aria-label="Увеличить" ${controlsDisabled ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div class="cart-item-total">
                    ${formatPrice(item.price * item.quantity)}
                </div>
                
                <button class="cart-item-remove" data-key="${item.key}" aria-label="Удалить товар">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

function getProductColors(productId) {
    const product = products.find(p => p.id === productId);
    return product ? product.colors : [];
}

function getProductSizes(productId) {
    const product = products.find(p => p.id === productId);
    return product ? product.sizes : [];
}

function getProductVariants(productId) {
    const product = products.find(p => p.id === productId);
    return Array.isArray(product?.variants) ? product.variants : [];
}

function findVariant(productId, color, size) {
    const variants = getProductVariants(productId);
    return variants.find(v => v.color === color && v.size === size) || null;
}

function isColorAvailable(variants, color, selectedSize, currentColor) {
    if (!variants.length) return true;
    if (selectedSize) {
        return variants.some(v => v.color === color && v.size === selectedSize && (v.stock || 0) > 0)
            || color === currentColor;
    }
    return variants.some(v => v.color === color && (v.stock || 0) > 0) || color === currentColor;
}

function isSizeAvailable(variants, size, selectedColor, currentSize) {
    if (!variants.length) return true;
    if (selectedColor) {
        return variants.some(v => v.size === size && v.color === selectedColor && (v.stock || 0) > 0)
            || size === currentSize;
    }
    return variants.some(v => v.size === size && (v.stock || 0) > 0) || size === currentSize;
}

function getMaxQtyForItem(item) {
    const variants = getProductVariants(item.id);
    if (variants.length > 0) {
        let variant = null;
        if (item.variantId !== undefined && item.variantId !== null) {
            variant = variants.find(v => String(v.id) === String(item.variantId));
        }
        if (!variant) {
            variant = variants.find(v => v.color === item.color && v.size === item.size);
        }
        return variant ? (variant.stock || 0) : 0;
    }

    const product = products.find(p => p.id === item.id);
    return product?.stock ?? item.stock ?? 0;
}

function clampCartQuantities(items) {
    let changed = false;
    const updated = items.map(item => {
        const maxQty = getMaxQtyForItem(item);
        if (maxQty > 0 && item.quantity > maxQty) {
            changed = true;
            return { ...item, quantity: maxQty };
        }
        return item;
    });

    if (changed) {
        cart.setItems(updated);
    }

    return updated;
}

function attachCartItemListeners() {
    // Quantity controls
    document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            const item = cart.getItems().find(i => i.key === key);
            if (item) {
                const maxQty = getMaxQtyForItem(item);
                cart.updateQuantity(key, item.quantity - 1, maxQty > 0 ? maxQty : 1);
                renderCart();
            }
        });
    });

    document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            const item = cart.getItems().find(i => i.key === key);
            if (item) {
                const maxQty = getMaxQtyForItem(item);
                if (maxQty <= 0) {
                    showToast('Нет в наличии для выбранного варианта', 'error');
                    cart.updateQuantity(key, 1, 1);
                    renderCart();
                    return;
                }
                if (item.quantity >= maxQty) {
                    showToast('Доступно меньшее количество', 'info');
                    return;
                }
                cart.updateQuantity(key, item.quantity + 1, maxQty);
                renderCart();
            }
        });
    });

    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.key;
            const item = cart.getItems().find(i => i.key === key);
            if (!item) return;
            const maxQty = getMaxQtyForItem(item);
            if (maxQty <= 0) {
                showToast('Нет в наличии для выбранного варианта', 'error');
                cart.updateQuantity(key, 1, 1);
                renderCart();
                return;
            }
            const quantity = parseInt(input.value) || 1;
            const clamped = Math.max(1, Math.min(maxQty, quantity));
            if (quantity > maxQty) {
                showToast('Доступно меньшее количество', 'info');
            }
            cart.updateQuantity(key, clamped, maxQty);
            renderCart();
        });
    });

    // Color/Size selects
    document.querySelectorAll('.color-select').forEach(select => {
        select.addEventListener('change', () => {
            const key = select.dataset.key;
            const color = select.value;
            const item = cart.getItems().find(i => i.key === key);
            if (!item) return;

            const variants = getProductVariants(item.id);
            if (variants.length > 0) {
                const variant = findVariant(item.id, color, item.size);
                if (!variant || (variant.stock || 0) <= 0) {
                    showToast('Нет в наличии для выбранного варианта', 'error');
                    select.value = item.color;
                    return;
                }
                cart.updateItem(key, { color, variantId: variant.id });
            } else {
                cart.updateItem(key, { color });
            }

            renderCart();
        });
    });

    document.querySelectorAll('.size-select').forEach(select => {
        select.addEventListener('change', () => {
            const key = select.dataset.key;
            const size = select.value;
            const item = cart.getItems().find(i => i.key === key);
            if (!item) return;

            const variants = getProductVariants(item.id);
            if (variants.length > 0) {
                const variant = findVariant(item.id, item.color, size);
                if (!variant || (variant.stock || 0) <= 0) {
                    showToast('Нет в наличии для выбранного варианта', 'error');
                    select.value = item.size;
                    return;
                }
                cart.updateItem(key, { size, variantId: variant.id });
            } else {
                cart.updateItem(key, { size });
            }

            renderCart();
        });
    });

    // Remove buttons
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            cart.removeItem(key);
            showToast('Товар удален из корзины', 'info');
            renderCart();
        });
    });
}

async function updateCartSummary() {
    const items = cart.getItems();

    // Apply discounts to get actual prices
    const itemsWithDiscounts = await applyDiscountsToCartItems(items);

    // Calculate subtotal WITHOUT discounts (original prices)
    const subtotalWithoutDiscounts = itemsWithDiscounts.reduce((sum, item) => {
        return sum + ((item.originalPrice || item.price) * item.quantity);
    }, 0);

    // Calculate subtotal WITH discounts applied
    const subtotalWithDiscounts = itemsWithDiscounts.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate total discount savings (from discount system)
    const totalDiscountSavings = itemsWithDiscounts.reduce((sum, item) => {
        if (item.appliedDiscount && item.originalPrice) {
            return sum + ((item.originalPrice - item.price) * item.quantity);
        }
        return sum;
    }, 0);

    const appliedPromo = promo.getApplied();
    // Calculate promo discount based on subtotal AFTER product discounts
    const promoDiscount = promo.calculate(subtotalWithDiscounts, items);

    // Calculate delivery using settings
    const delivery = subtotalWithDiscounts >= cartSettings.freeShippingThreshold ? 0 : cartSettings.shippingCost;

    // Calculate VAT if enabled
    const subtotalAfterPromo = subtotalWithDiscounts - promoDiscount;
    const vat = cartSettings.vatRate > 0 ? Math.round(subtotalAfterPromo * cartSettings.vatRate / 100) : 0;

    const total = subtotalAfterPromo + delivery + vat;

    // Update UI
    document.getElementById('summaryItemCount').textContent = cart.getCount();
    document.getElementById('summarySubtotal').textContent = formatPrice(subtotalWithoutDiscounts);

    // Show discount savings if any
    const discountRow = document.getElementById('discountRow');
    const totalDiscount = totalDiscountSavings + promoDiscount;

    if (totalDiscount > 0) {
        discountRow.style.display = 'flex';
        let discountText = '';
        if (totalDiscountSavings > 0 && promoDiscount > 0) {
            discountText = `-${formatPrice(totalDiscountSavings)} (скидки) + -${formatPrice(promoDiscount)} (промокод)`;
        } else if (totalDiscountSavings > 0) {
            discountText = `-${formatPrice(totalDiscountSavings)}`;
        } else if (promoDiscount > 0) {
            discountText = `-${formatPrice(promoDiscount)}`;
        }
        document.getElementById('summaryDiscount').textContent = discountText;
    } else {
        discountRow.style.display = 'none';
    }

    // Delivery
    const deliveryText = delivery === 0 ? 'Бесплатно' : formatPrice(delivery);
    document.getElementById('summaryDelivery').textContent = deliveryText;

    // VAT
    const vatRow = document.getElementById('vatRow');
    if (vat > 0 && vatRow) {
        vatRow.style.display = 'flex';
        document.getElementById('summaryVatAmount').textContent = formatPrice(vat);
    } else if (vatRow) {
        vatRow.style.display = 'none';
    }

    // Total
    document.getElementById('summaryTotal').textContent = formatPrice(total);

    // Update promo UI
    updatePromoUI();
}

function updatePromoUI() {
    const appliedPromo = promo.getApplied();
    const promoApplied = document.getElementById('promoApplied');
    const promoForm = document.getElementById('promoForm');
    const promoMessage = document.getElementById('promoMessage');

    if (appliedPromo) {
        promoApplied.style.display = 'flex';
        document.getElementById('appliedPromoCode').textContent = appliedPromo.code;
        promoForm.style.display = 'none';
        promoMessage.innerHTML = '';
    } else {
        promoApplied.style.display = 'none';
        promoForm.style.display = 'flex';
    }
}

function initializeCartPage() {
    // Promo form
    const promoForm = document.getElementById('promoForm');
    const promoInput = document.getElementById('promoInput');
    const promoMessage = document.getElementById('promoMessage');

    promoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = promoInput.value.trim();

        if (!code) {
            promoMessage.innerHTML = '<span class="error">Введите промокод</span>';
            return;
        }

        // Get customer identifier from checkout form if available
        const customerEmail = document.getElementById('email')?.value;
        const customerPhone = document.getElementById('phone')?.value;
        const customerIdentifier = customerEmail || customerPhone || null;

        // Get subtotal
        const items = cart.getItems();
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const result = await promo.apply(code, subtotal, customerIdentifier);

        if (result.success) {
            promoMessage.innerHTML = '<span class="success">Промокод применен!</span>';
            promoInput.value = '';
            await updateCartSummary();
            showToast(`Промокод применен! Скидка ${formatPrice(result.discount)}`, 'success');

            setTimeout(() => {
                promoMessage.innerHTML = '';
            }, 2000);
        } else {
            promoMessage.innerHTML = `<span class="error">${result.message}</span>`;
        }
    });

    // Remove promo
    const removePromoBtn = document.getElementById('removePromo');
    if (removePromoBtn) {
        removePromoBtn.addEventListener('click', async () => {
            promo.remove();
            await updateCartSummary();
            showToast('Промокод удален', 'info');
        });
    }

    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutModalOverlay = document.getElementById('checkoutModalOverlay');
    const checkoutModalClose = document.getElementById('checkoutModalClose');
    const checkoutForm = document.getElementById('checkoutForm');
    const customerPhone = document.getElementById('customerPhone');

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            const items = cart.getItems();

            // Apply discounts to get actual prices
            const itemsWithDiscounts = await applyDiscountsToCartItems(items);

            // Calculate subtotal with discounts
            const subtotal = itemsWithDiscounts.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const appliedPromo = promo.getApplied();
            const discount = promo.calculate(subtotal, items);
            const shipping = subtotal >= cartSettings.freeShippingThreshold ? 0 : cartSettings.shippingCost;

            // Calculate VAT if enabled
            const subtotalAfterDiscount = subtotal - discount;
            const vat = cartSettings.vatRate > 0 ? Math.round(subtotalAfterDiscount * cartSettings.vatRate / 100) : 0;

            const total = subtotalAfterDiscount + shipping + vat;

            // Update summary in modal - use querySelectorAll to update modal elements specifically
            const modalSummaryItemCount = checkoutModal.querySelector('#summaryItemCount');
            const modalSummarySubtotal = checkoutModal.querySelector('#summarySubtotal');
            const modalSummaryShipping = checkoutModal.querySelector('#summaryShipping');
            const modalSummaryTotal = checkoutModal.querySelector('#summaryTotal');
            const discountRow = checkoutModal.querySelector('#summaryDiscountRow');
            const modalSummaryDiscountAmount = checkoutModal.querySelector('#summaryDiscountAmount');
            const vatRow = checkoutModal.querySelector('#summaryVatRow');
            const modalSummaryVat = checkoutModal.querySelector('#summaryVat');

            if (modalSummaryItemCount) modalSummaryItemCount.textContent = items.length;
            if (modalSummarySubtotal) modalSummarySubtotal.textContent = formatPrice(subtotal);

            // Show discount if applied
            if (discount > 0 && discountRow) {
                discountRow.style.display = 'flex';
                if (modalSummaryDiscountAmount) modalSummaryDiscountAmount.textContent = '-' + formatPrice(discount);
            } else if (discountRow) {
                discountRow.style.display = 'none';
            }

            if (modalSummaryShipping) modalSummaryShipping.textContent = shipping === 0 ? 'Бесплатно' : formatPrice(shipping);

            // Show VAT if enabled
            if (vat > 0 && vatRow) {
                vatRow.style.display = 'flex';
                if (modalSummaryVat) modalSummaryVat.textContent = formatPrice(vat);
            } else if (vatRow) {
                vatRow.style.display = 'none';
            }

            if (modalSummaryTotal) modalSummaryTotal.textContent = formatPrice(total);

            checkoutModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
    }

    const closeCheckoutModalFn = () => {
        checkoutModal.classList.remove('open');
        document.body.style.overflow = '';
        checkoutForm.reset();
    };

    checkoutModalOverlay.addEventListener('click', closeCheckoutModalFn);
    checkoutModalClose.addEventListener('click', closeCheckoutModalFn);

    // Phone mask
    if (customerPhone) {
        customerPhone.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('998')) value = value.substring(3);

            let formatted = '+998';
            if (value.length > 0) formatted += ' (' + value.substring(0, 2);
            if (value.length > 2) formatted += ') ' + value.substring(2, 5);
            if (value.length > 5) formatted += '-' + value.substring(5, 7);
            if (value.length > 7) formatted += '-' + value.substring(7, 9);

            e.target.value = formatted;
        });
    }

    // Form submission
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('customerName').value.trim();
        const phone = document.getElementById('customerPhone').value.trim();
        const email = document.getElementById('customerEmail').value.trim();
        const address = document.getElementById('customerAddress').value.trim();
        const notes = document.getElementById('customerNotes').value.trim();

        if (!name || !phone || !address) {
            showToast('Заполните все обязательные поля', 'error');
            return;
        }

        const items = cart.getItems();

        // Apply discounts to get actual prices
        const itemsWithDiscounts = await applyDiscountsToCartItems(items);

        // Calculate subtotal with discounts
        const subtotal = itemsWithDiscounts.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const appliedPromo = promo.getApplied();
        const discount = promo.calculate(subtotal, items);
        const shipping = subtotal >= cartSettings.freeShippingThreshold ? 0 : cartSettings.shippingCost;

        // Calculate VAT if enabled
        const subtotalAfterDiscount = subtotal - discount;
        const vat = cartSettings.vatRate > 0 ? Math.round(subtotalAfterDiscount * cartSettings.vatRate / 100) : 0;

        const total = subtotalAfterDiscount + shipping + vat;

        // Create order via API
        try {
            const orderData = {
                customerPhone: phone,
                customerName: name,
                customerEmail: email || null,
                shippingAddress: address,
                items: itemsWithDiscounts.map(item => ({
                    productId: item.id,
                    variantId: item.variantId ?? item.variant_id ?? null,
                    title: item.title,
                    sku: item.sku || `SKU-${item.id}`,
                    price: item.price, // Price after discount
                    quantity: item.quantity,
                    size: item.size,
                    color: item.color
                })),
                subtotal,
                shipping,
                discount,
                total,
                paymentMethod: 'card',
                notes: notes || null,
                promoCode: appliedPromo ? appliedPromo.code : null
            };

            // Use API if available, fallback to REPO
            let order;
            if (typeof API !== 'undefined' && API.orders) {
                order = await API.orders.create(orderData);
            } else if (typeof REPO !== 'undefined') {
                order = REPO.createOrder(orderData);
            } else {
                throw new Error('No API or REPO available');
            }

            // Record promo usage if applicable
            if (appliedPromo && discount > 0) {
                await promo.recordUsage(
                    order.id,
                    discount,
                    phone
                );
            }

            // Show success modal
            const orderNumber = order.orderNumber || order.order_number || `ORD-${Date.now()}`;
            document.getElementById('orderNumber').textContent = orderNumber;
            closeCheckoutModalFn();

            const successModal = document.getElementById('successModal');
            successModal.classList.add('open');

            // Clear cart
            cart.clear();
            promo.remove(); // Clear applied promo code
            renderCart();

            console.log('✅ Order created successfully:', order);
            showToast('Заказ успешно оформлен!', 'success');
        } catch (error) {
            console.error('❌ Order creation failed:', error);
            showToast('Ошибка при оформлении заказа. Попробуйте еще раз.', 'error');
        }
    });

    // Success modal
    const successModal = document.getElementById('successModal');
    const successModalOverlay = document.getElementById('successModalOverlay');
    const successModalClose = document.getElementById('successModalClose');
    const closeSuccessModal = document.getElementById('closeSuccessModal');

    const closeSuccessModalFn = () => {
        successModal.classList.remove('open');
        document.body.style.overflow = '';
        window.location.href = '/';
    };

    if (successModalOverlay) successModalOverlay.addEventListener('click', closeSuccessModalFn);
    if (successModalClose) successModalClose.addEventListener('click', closeSuccessModalFn);
    if (closeSuccessModal) closeSuccessModal.addEventListener('click', closeSuccessModalFn);
}
