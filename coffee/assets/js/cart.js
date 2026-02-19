// assets/js/cart.js
(function () {
  // single init guard
  if (window.__brewNovaCartInit) return;
  window.__brewNovaCartInit = true;

  const STORAGE_KEY = 'brewNovaCart_v1';
  const BUTTON_SELECTOR = '.products__button';
  const PRODUCTS_CONTAINER_SELECTOR = '.products__container';
  const CART_ITEMS_CONTAINER_SELECTOR = '.cart__items';
  const CART_COUNT_SELECTOR = '.cart-count';
  const ADD_DEBOUNCE_MS = 600; // ms to block duplicate rapid adds

  /* ---------- Storage helpers ---------- */
  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('loadCart error', e);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      updateCartCount(cart);
    } catch (e) {
      console.error('saveCart error', e);
    }
  }

  /* ---------- UI helpers ---------- */
  function formatCurrency(amount) {
    // display without decimals when integer, otherwise two decimals
    const num = Number(amount || 0);
    return '$ ' + (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2));
  }

  function escapeForSelector(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  // small UI helpers: toast and confirm/undo
  function createToastArea() {
    let area = document.querySelector('.cart-toast-area');
    if (!area) {
      area = document.createElement('div');
      area.className = 'cart-toast-area';
      document.body.appendChild(area);
    }
    return area;
  }

  function showToast(message, { type = 'info', duration = 4000, action } = {}) {
    const area = createToastArea();
    const node = document.createElement('div');
    node.className = `cart-toast cart-toast--${type}`;

    const textNode = document.createElement('div');
    textNode.textContent = message;
    node.appendChild(textNode);

    if (action && typeof action.onClick === 'function') {
      const btn = document.createElement('button');
      btn.textContent = action.label || 'Undo';
      btn.className = 'cart-toast__action';
      btn.addEventListener('click', () => {
        try { action.onClick(); } catch (e) { console.error(e); }
        node.remove();
      });
      node.appendChild(btn);
    }

    area.appendChild(node);

    if (duration) {
      setTimeout(() => node.remove(), duration);
    }
  }

  function updateCartCount(cart) {
    const el = document.querySelector(CART_COUNT_SELECTOR);
    if (!el) return;
    const total = Array.isArray(cart) ? cart.reduce((s, it) => s + (Number(it.quantity || 0)), 0) : 0;
    el.textContent = total;
  }

  /* ---------- Duplicate protection ---------- */
  function canAddNow(id) {
    try {
      const key = `lastAdded:${id}`;
      const last = parseInt(sessionStorage.getItem(key) || '0', 10);
      const now = Date.now();
      if (now - last < ADD_DEBOUNCE_MS) return false;
      sessionStorage.setItem(key, String(now));
      return true;
    } catch (e) {
      return true;
    }
  }

  /* ---------- Add to cart (index page) ---------- */
  function addToCart(product) {
  if (!product || !product.id) return;
  if (!canAddNow(product.id)) return;

  const cart = loadCart();
  const idx = cart.findIndex(i => i.id === product.id);
  if (idx > -1) {
    // increase quantity and update price to latest
    cart[idx].quantity = Math.min((cart[idx].quantity || 0) + 1, 99);
    cart[idx].price = product.price; // update price to current value
  } else {
    cart.push(Object.assign({}, product, { quantity: 1 }));
  }
  saveCart(cart);
  flashButton(product.id);
}

  function flashButton(id) {
    try {
      const selectorId = escapeForSelector(id);
      const card = document.querySelector(`.products__card[data-id="${selectorId}"]`);
      if (!card) return;
      const btn = card.querySelector(BUTTON_SELECTOR);
      if (!btn) return;
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 300);
    } catch (e) {
      // ignore visual feedback errors
    }
  }

  function generateId(card) {
    const nameEl = card.querySelector('.products__name');
    const base = nameEl ? nameEl.textContent.trim().toLowerCase().replace(/\s+/g, '-') : 'product';
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function initIndexPage() {
    const container = document.querySelector(PRODUCTS_CONTAINER_SELECTOR);
    if (!container) return;

    container.addEventListener('click', function (ev) {
      const btn = ev.target.closest(BUTTON_SELECTOR);
      if (!btn || !container.contains(btn)) return;

      ev.stopPropagation();
      ev.preventDefault();

      const card = btn.closest('.products__card');
      if (!card) return;

      const id = card.getAttribute('data-id') || generateId(card);
      // If card didn't have data-id, persist generated id on the card so future adds match
      if (!card.getAttribute('data-id')) card.setAttribute('data-id', id);

      const nameEl = card.querySelector('.products__name');
      const priceEl = card.querySelector('.products__price');
      const imgEl = card.querySelector('.products__coffee');

      const name = nameEl ? nameEl.textContent.trim() : 'Product';
      // Prefer numeric data-price attribute; fallback strip non-digits
      const priceRaw = priceEl ? (priceEl.getAttribute('data-price') || priceEl.textContent.replace(/[^0-9.]/g, '')) : '0';
      const price = parseFloat(priceRaw) || 0;
      const img = imgEl ? imgEl.getAttribute('src') : '';

      addToCart({ id, name, price, img });
    }, false);
  }

  /* ---------- Cart page rendering & controls ---------- */
  function renderCart() {
    const container = document.querySelector('.cart__items');
    if (!container) return;

    const template = container.querySelector('.cart__card.template');
    const emptyView = container.querySelector('.cart__empty');

    // Remove any previously rendered (non-template) cards immediately
    container.querySelectorAll('.cart__card:not(.template)').forEach(n => n.remove());

    const cart = loadCart();

    const summaryEl = document.querySelector('.cart__summary');

    if (!cart || cart.length === 0) {
      // show empty state
      if (emptyView) emptyView.hidden = false;
      if (template) template.hidden = true;
      if (summaryEl) summaryEl.style.display = 'none';
      updateSummary([]);
      updateCartCount([]);
      return;
    } else {
      if (emptyView) emptyView.hidden = true;
      if (template) template.hidden = true;
      if (summaryEl) summaryEl.style.display = '';
    }

    // Now clone template for each cart item
    cart.forEach(item => {
      const clone = template.cloneNode(true);
      clone.classList.remove('template');
      clone.hidden = false;
      clone.dataset.id = item.id;

      // populate fields...
      const img = clone.querySelector('.cart__thumb img');
      if (img) { img.src = item.img || ''; img.alt = item.name || ''; }

      const nameEl = clone.querySelector('.cart__name');
      if (nameEl) nameEl.textContent = item.name || '';

      const metaEl = clone.querySelector('.cart__meta');
      if (metaEl) metaEl.textContent = item.meta || '';

      const qtyInput = clone.querySelector('.qty__input');
      if (qtyInput) {
        qtyInput.value = item.quantity || 1;
        qtyInput.addEventListener('change', function () {
          const q = Math.max(1, parseInt(this.value, 10) || 1);
          this.value = q;
          updateQuantity(item.id, q);
        });
      }

      const priceEl = clone.querySelector('.price__current');
      if (priceEl) {
        const unit = Number(item.price || 0);
        priceEl.dataset.price = unit;
        priceEl.textContent = formatCurrency(unit * (item.quantity || 1));
      }

      const remBtn = clone.querySelector('.remove');
      if (remBtn) remBtn.addEventListener('click', () => removeItem(item.id));

      if (emptyView) container.insertBefore(clone, emptyView);
      else container.appendChild(clone);
    });

    updateSummary(cart);
    updateCartCount(cart);
    renderCouponUI();
  }

  function updateQuantity(id, newQty) {
    const cart = loadCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    cart[idx].quantity = Math.min(Math.max(newQty, 1), 99);
    saveCart(cart);

    // update row price and input in-place if present
    const escapedId = escapeForSelector(id);
    const row = document.querySelector(`.cart__card[data-id="${escapedId}"]`);
    if (row) {
      const unit = Number(cart[idx].price || 0);
      const priceEl = row.querySelector('.price__current');
      if (priceEl) priceEl.textContent = formatCurrency(unit * cart[idx].quantity);
      const qtyInp = row.querySelector('.qty__input');
      if (qtyInp) qtyInp.value = cart[idx].quantity;
    }

    updateSummary(cart);
    updateCartCount(cart);
  }

  function removeItem(id) {
    // find item for undo
    const cart = loadCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;

    const removed = cart[idx];
    // remove immediately from storage/UI
    const newCart = cart.filter(i => i.id !== id);
    saveCart(newCart);
    renderCart();

    // show undo toast for 6s
    showToast(`${removed.name} removed`, {
      type: 'info',
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          const cur = loadCart();
          // restore at beginning (or restore position by your preference)
          cur.splice(idx, 0, removed);
          saveCart(cur);
          renderCart();
          showToast('Item restored', { type: 'success', duration: 2000 });
        }
      }
    });
  }

  function changeQuantity(id, delta) {
    const cart = loadCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    cart[idx].quantity = Math.min(Math.max((cart[idx].quantity || 0) + delta, 0), 99);
    if (cart[idx].quantity === 0) cart.splice(idx, 1);
    saveCart(cart);
    renderCart();
  }

  function updateSummary(cartArr) {
    const cart = Array.isArray(cartArr) ? cartArr : loadCart();
    let subtotal = 0;
    cart.forEach(i => { subtotal += (Number(i.price || 0) * (Number(i.quantity || 0))); });

    const couponCode = getAppliedCoupon();
    const discountAmount = computeDiscountAmount(subtotal, couponCode);

    // Delivery rule: $50 if subtotal < 500 unless FREESHIP coupon applied
    let delivery = subtotal > 0 && subtotal < 500 ? 50 : 0;
    if (couponCode && COUPONS[couponCode] && COUPONS[couponCode].type === 'freedelivery') {
      delivery = 0;
    }

    const discount = discountAmount || 0;
    const total = Math.max(subtotal + delivery - discount, 0);

    const subtotalEl = document.getElementById('subtotal');
    const deliveryEl = document.getElementById('delivery');
    const discountEl = document.getElementById('discount');
    const totalEl = document.getElementById('total');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (deliveryEl) deliveryEl.textContent = formatCurrency(delivery);
    if (discountEl) discountEl.textContent = (discount > 0 ? `- ${formatCurrency(discount)}` : '- $0');
    if (totalEl) totalEl.textContent = formatCurrency(total);
  }

  /* ---------- Coupon handling ---------- */
  const COUPON_KEY = 'brewNovaCart_coupon';

  const COUPONS = {
    'SAVE10': { type: 'percent', value: 10, description: '10% off subtotal' },
    'FLAT50': { type: 'amount', value: 50, description: 'Rs. 50 off' },
    'FREESHIP': { type: 'freedelivery', value: 0, description: 'Free delivery' }
  };

  function getAppliedCoupon() {
  try {
    return localStorage.getItem(COUPON_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setAppliedCoupon(code) {
  try {
    if (code) localStorage.setItem(COUPON_KEY, code);
    else localStorage.removeItem(COUPON_KEY);
  } catch (e) {
    // ignore storage errors
  }
}

function renderCouponUI() {
  const container = document.querySelector('.coupon');
  if (!container) return;

  // remove existing UI extras
  const existingChip = container.querySelector('.coupon__chip');
  if (existingChip) existingChip.remove();

  const applied = getAppliedCoupon();
  if (applied && COUPONS[applied]) {
    const chip = document.createElement('div');
    chip.className = 'coupon__chip';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '8px';
    chip.style.marginLeft = '12px';
    chip.style.padding = '6px 10px';
    chip.style.background = '#eef6ff';
    chip.style.border = '1px solid #b6e0ff';
    chip.style.borderRadius = '999px';
    chip.style.fontSize = '0.95rem';
    chip.textContent = `${applied} — ${COUPONS[applied].description}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.title = 'Remove coupon';
    removeBtn.innerHTML = '&times;';
    removeBtn.style.marginLeft = '8px';
    removeBtn.style.background = 'transparent';
    removeBtn.style.border = 'none';
    removeBtn.style.cursor = 'pointer';
    removeBtn.addEventListener('click', function () {
      setAppliedCoupon(null);
      renderCouponUI();
      renderCart();
      showToast('Coupon removed', { type: 'info', duration: 2500 });
    });

    chip.appendChild(removeBtn);
    container.appendChild(chip);
  }
}

function initCouponUI() {
  const applyBtn = document.querySelector('.coupon__apply');
  const input = document.querySelector('.coupon__input');

  if (!applyBtn || !input) return;

  // show persisted code in input if any
  const existing = getAppliedCoupon();
  if (existing) input.value = existing;

  renderCouponUI();

  applyBtn.addEventListener('click', async function () {
    const code = (input.value || '').trim().toUpperCase();
    applyBtn.disabled = true;
    if (!code) {
      showToast('Enter a coupon code', { type: 'error' });
      applyBtn.disabled = false;
      return;
    }
    if (!COUPONS[code]) {
      showToast('Invalid coupon', { type: 'error' });
      applyBtn.disabled = false;
      return;
    }
    // persist and update UI
    setAppliedCoupon(code);
    renderCouponUI();
    renderCart();
    showToast(`Coupon applied: ${code}`, { type: 'success' });
    applyBtn.disabled = false;
  });
}

  // Compute discount amount given subtotal and an applied coupon code
  function computeDiscountAmount(subtotal, couponCode) {
    if (!couponCode) return 0;
    const c = COUPONS[couponCode];
    if (!c) return 0;

    if (c.type === 'percent') {
      return Math.round((c.value / 100) * subtotal * 100) / 100; // two-decimal rounding
    } else if (c.type === 'amount') {
      return Math.min(c.value, subtotal); // don't exceed subtotal
    } else if (c.type === 'freedelivery') {
      return 0; // discount is represented as zero; delivery will be overridden to 0
    }
    return 0;
  }

  /* ---------- Page initialization ---------- */
  function initIndexAndCart() {
    initIndexPage();
    initCartPage();
    // ensure header counter visible on load
    updateCartCount(loadCart());
  }

  function initCartPage() {
    const container = document.querySelector(CART_ITEMS_CONTAINER_SELECTOR);
    if (!container) return;
    renderCart();
    initCouponUI()

    // Delegate inc/dec/remove clicks for controls that might exist
    container.addEventListener('click', function (ev) {
      const inc = ev.target.closest('.cart-item__inc') || ev.target.closest('.cart__inc');
      const dec = ev.target.closest('.cart-item__dec') || ev.target.closest('.cart__dec');
      const rem = ev.target.closest('.cart-item__remove') || ev.target.closest('.remove');

      if (inc) {
        const id = inc.closest('.cart__card')?.dataset?.id;
        if (id) changeQuantity(id, 1);
        return;
      }
      if (dec) {
        const id = dec.closest('.cart__card')?.dataset?.id;
        if (id) changeQuantity(id, -1);
        return;
      }
      if (rem) {
        const id = rem.closest('.cart__card')?.dataset?.id;
        if (id) removeItem(id);
        return;
      }
    }, false);
  }

  /* ---------- DOM ready ---------- */
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(initIndexAndCart);

  // Expose small API for debug (optional)
  window.__brewNovaCart = {
    loadCart,
    saveCart,
    addToCart,
    renderCart,
    updateQuantity,
    removeItem
  };
})();