// add-to-cart.js
// Basic Add to Cart functionality using localStorage

(function () {
  const STORAGE_KEY = 'coffee_shop_cart_v1';

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load cart', e);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }

  function findProductInCart(cart, name) {
    return cart.find(item => item.name === name);
  }

  function formatPrice(priceText) {
    // Accepts formats like "$15.90" or "15.90"
    if (!priceText) return 0;
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function showToast(message, timeout = 1800) {
    let toast = document.createElement('div');
    toast.className = 'bcai-toast';
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'sans-serif',
      fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 250ms';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 260);
    }, timeout);
  }

  function addToCart(product) {
    const cart = loadCart();
    const existing = findProductInCart(cart, product.name);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push(Object.assign({ quantity: 1, id: Date.now() }, product));
    }
    saveCart(cart);
    return cart;
  }

  function handleButtonClick(e) {
    const btn = e.currentTarget;
    const card = btn.closest('.products__card');
    if (!card) return;

    const nameEl = card.querySelector('.products__name');
    const priceEl = card.querySelector('.products__price');
    const imgEl = card.querySelector('.products__coffee');

    const name = nameEl ? nameEl.textContent.trim() : 'Unknown product';
    const price = formatPrice(priceEl ? priceEl.textContent : '');
    const image = imgEl ? imgEl.getAttribute('src') : '';

    const product = { name, price, image };

    const cart = addToCart(product);
    const addedItem = cart.find(item => item.name === name);

    showToast(`Added: ${name} × ${addedItem.quantity}`);
    // For debugging: log the cart
    console.log('Cart updated:', cart);
  }

  function init() {
    document.querySelectorAll('.products__button').forEach(btn => {
      btn.addEventListener('click', handleButtonClick);
    });
  }

  // Expose a small API for debugging (optional)
  window.bcaCart = {
    getCart: loadCart,
    clearCart: function () { saveCart([]); console.log('Cart cleared'); },
    storageKey: STORAGE_KEY
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();