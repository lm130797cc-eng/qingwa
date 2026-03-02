
/**
 * Ant Island Referral Tracking Script
 * Add this to your Shopify Theme (theme.liquid) inside <head> or at the end of <body>
 */

(function() {
  const STORAGE_KEY = 'ant_ref_code';
  const COOKIE_NAME = 'ant_ref_code';
  const COOKIE_DAYS = 30;

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }

  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // 1. Capture Ref Code from URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');

  if (refCode) {
    // Validate format (REF_XXXXXXXX)
    if (/^REF_[A-Z0-9]{8}$/.test(refCode)) {
      console.log('🐜 Ant Referral Captured:', refCode);
      localStorage.setItem(STORAGE_KEY, refCode);
      setCookie(COOKIE_NAME, refCode, COOKIE_DAYS);
    }
  }

  // 2. Inject into Checkout (if possible via ScriptTag) or Cart Attributes
  // This part usually requires Shopify Plus for checkout customization, 
  // but for standard plans, we can add it to Cart Attributes via AJAX or hidden input forms.
  
  const currentRef = localStorage.getItem(STORAGE_KEY) || getCookie(COOKIE_NAME);
  
  if (currentRef) {
    // Attempt to add to cart attributes via fetch if cart exists
    fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attributes: {
          'Referral Code': currentRef
        }
      })
    }).then(() => {
      console.log('🐜 Referral attached to cart:', currentRef);
    }).catch(err => console.error('Referral attach failed', err));
  }

})();
