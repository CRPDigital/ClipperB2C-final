(() => {
  if (window.__CART_RECS_INIT__) return;
  window.__CART_RECS_INIT__ = true;

  const CART_ENDPOINTS = ['/cart/add', '/cart/change', '/cart/update'];
  const ROOT = window.Shopify?.routes?.root || '/';

  const currency = () =>
    (window.Shopify && Shopify.currency && Shopify.currency.active) || 'DKK';

  const fmt = (cents) =>
    (cents / 100).toLocaleString(Shopify?.locale || 'da-DK', {
      style: 'currency',
      currency: currency(),
    });

  function getContainer() {
    return document.querySelector('#cart-recommendations .recommendations-scroll');
  }

  function render(products) {
    const container = getContainer();
    if (!container) return;
    container.innerHTML = '';
    products.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'recommendation-slide';
      el.innerHTML = `
        <a href="${p.url}" class="recommendation-link">
          <img src="${p.featured_image}" alt="${p.title}" loading="lazy" />
        </a>
        <div class="recommendation-title">${p.title}</div>
        <div class="recommendation-price">${fmt(p.price)}</div>
      `;
      container.appendChild(el);
    });
  }

  async function loadRecommendations() {
    try {
      const container = getContainer();
      if (!container) return;

      const cart = await fetch(`${ROOT}cart.js`).then(r => r.json());
      if (!cart.items || !cart.items.length) {
        container.innerHTML = '';
        return;
      }
      const productId = cart.items[0].product_id;
      const { products } = await fetch(
        `${ROOT}recommendations/products.json?product_id=${productId}&limit=8&intent=related`
      ).then(r => r.json());

      container.innerHTML = '';
      if (!products || !products.length) return;
      render(products);
    } catch (e) {
      console.error('[cart-recs] load error', e);
    }
  }

  // ---- Event hooks ----
  document.addEventListener('cart:refresh', loadRecommendations);
  document.addEventListener('cart:updated', loadRecommendations);

  // ---- Intercept fetch ----
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource] =
      typeof args[0] === 'string' ? [args[0]] : [args[0]?.url || ''];
    const resp = await origFetch(...args);

    if (
      typeof resource === 'string' &&
      CART_ENDPOINTS.some((p) => resource.includes(p)) &&
      resp.ok
    ) {
      setTimeout(loadRecommendations, 100);
    }

    return resp;
  };

  // ---- Intercept XHR ----
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, async, ...rest) {
    this.__isCartReq =
      typeof url === 'string' &&
      CART_ENDPOINTS.some((p) => url.indexOf(p) !== -1);
    return origOpen.call(this, method, url, async, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...sendArgs) {
    this.addEventListener('load', () => {
      if (this.__isCartReq && this.status >= 200 && this.status < 400) {
        setTimeout(loadRecommendations, 100);
      }
    });
    return origSend.apply(this, sendArgs);
  };

  // Første load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRecommendations, { once: true });
  } else {
    loadRecommendations();
  }
})();

(() => {
  if (window.__TERMS_POPUP__) return;
  window.__TERMS_POPUP__ = true;

  const CART_ENDPOINTS = ['/cart/add', '/cart/change', '/cart/update'];

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getTermsCheckbox() {
    return (
      q('[data-terms-checkbox]') ||
      q('#terms-checkbox') ||
      q('input[type="checkbox"][name*="terms" i]') ||
      q('input[type="checkbox"][id*="terms" i]')
    );
  }

  function getCheckoutTriggers() {
    return [
      ...qa('button[name="checkout"]'),
      ...qa('input[name="checkout"]'),
      ...qa('[data-checkout]'),
      ...qa('button[formaction*="/checkout"]'),
      ...qa('a[href^="/checkout"]'),
      ...qa('a[href*="/checkout?"]'),
    ];
  }

  function showPopup(cb) {
    if (!cb) return;
    const wrapper = cb.closest('.terms-wrapper') || cb.parentElement;
    if (!wrapper) return;

    if (wrapper.querySelector('.terms-error-popup')) return; // undgå duplicates

    const popup = document.createElement('div');
    popup.className = 'terms-error-popup';
    popup.textContent = 'Accepter handelsbetingelserne først';

    wrapper.style.position = 'relative';
    wrapper.appendChild(popup);

    setTimeout(() => popup.remove(), 2500);
  }

  function blockIfNotAccepted(e) {
    const cb = getTermsCheckbox();
    if (cb && cb.checked) return; // OK

    e.preventDefault();
    e.stopPropagation();
    showPopup(cb);
  }

  function bindValidation() {
    const cb = getTermsCheckbox();
    const triggers = getCheckoutTriggers();

    if (!cb || triggers.length === 0) return;

    triggers.forEach((el) => {
      if (!el.__termsBound) {
        el.addEventListener('click', blockIfNotAccepted, true);
        const form = el.closest('form');
        if (form) form.addEventListener('submit', blockIfNotAccepted, true);
        el.__termsBound = true;
      }
    });
  }

  // Re-bind efter cart ændringer (fetch/XHR)
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const resp = await origFetch(...args);
    if (url && CART_ENDPOINTS.some((p) => url.includes(p)) && resp.ok) {
      setTimeout(bindValidation, 50);
    }
    return resp;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__termsReq = url && CART_ENDPOINTS.some((p) => url.includes(p));
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (this.__termsReq && this.status >= 200 && this.status < 400) {
        setTimeout(bindValidation, 50);
      }
    });
    return origSend.apply(this, args);
  };

  document.addEventListener('cart:refresh', bindValidation);
  document.addEventListener('cart:updated', bindValidation);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindValidation, { once: true });
  } else {
    bindValidation();
  }
})();



