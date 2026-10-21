'use client';
/**
 * The browser keeps only the cart id. btab keeps the cart and prices it.
 * The cart id is the cart's secret: anyone who has it can read the cart.
 */
const CART_KEY = 'btab_cart_id';
const SESSION_KEY = 'btab_checkout_session_id';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode: the cart lives for this page only */
  }
}

export const cartId = () => read(CART_KEY);
export const setCartId = (id: string | null) => {
  write(CART_KEY, id);
  window.dispatchEvent(new Event('btab-cart'));
};
export const sessionId = () => read(SESSION_KEY);
export const setSessionId = (id: string | null) => write(SESSION_KEY, id);
