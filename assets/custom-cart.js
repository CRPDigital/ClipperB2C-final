(function () {
  const CONTAINER_SELECTOR = '#cart-upsell';
  const LOADED_ATTR = 'data-upsell-loaded';

  function loadUpsellOnce() {
    const el = document.querySelector(CONTAINER_SELECTOR);
    if (!el) return;
    if (el.getAttribute(LOADED_ATTR) === 'true') return;

    const productId = el.getAttribute('data-first-product-id');
    if (!productId) return;

    const url = `/recommendations/products?product_id=${encodeURIComponent(productId)}&limit=4&section_id=cart-recommendations`;

    fetch(url, { credentials: 'same-origin' })
      .then(r => r.text())
      .then(html => {
        // Hvis endpoint ikke returnerer noget, undgå at skrive tomt over
        if (html && html.trim().length > 0) {
          el.innerHTML = html;
          el.setAttribute(LOADED_ATTR, 'true');
        }
      })
      .catch(err => {
        console.error('[Cart Upsell] Fetch error:', err);
      });
  }

  function observeForDrawerAndReloads() {
    // Drawer markup bliver ofte indsat/erstattet dynamisk.
    const mo = new MutationObserver(() => loadUpsellOnce());
    mo.observe(document.body, { childList: true, subtree: true });

    // Theme editor / section reloads
    document.addEventListener('shopify:section:load', loadUpsellOnce);
    document.addEventListener('shopify:section:unload', loadUpsellOnce);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadUpsellOnce();
    observeForDrawerAndReloads();
  });
})();
