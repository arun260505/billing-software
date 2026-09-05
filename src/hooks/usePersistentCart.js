import { useEffect, useState } from "react";

/**
 * A cart that survives a reload.
 *
 * The cart lived in plain useState, so anything that remounted the page threw
 * away the order in progress: a refresh on the till, and — worse — Android
 * killing a backgrounded WebView while a waiter checked their phone. The order
 * had to be taken again at the table.
 *
 * Only the unsent cart is kept here. Anything already sent to the kitchen lives
 * on the server and is re-fetched, so this can never resurrect a stale order:
 * the worst case is a few lines a cashier had not yet sent, which they can see
 * and clear.
 *
 * Entries older than MAX_AGE are dropped rather than restored — a cart from
 * yesterday's shift is noise, not work in progress.
 *
 * @param {string} key   storage key, unique per screen (cashier vs waiter)
 * @returns {[Array, Function]} the usual [cart, setCart] pair
 */

const MAX_AGE_MS = 12 * 60 * 60 * 1000;   // one long shift

export default function usePersistentCart(key) {

    const [cart, setCart] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const saved = JSON.parse(raw);
            if (!saved || !Array.isArray(saved.items)) return [];
            if (Date.now() - Number(saved.savedAt || 0) > MAX_AGE_MS) {
                localStorage.removeItem(key);
                return [];
            }
            return saved.items;
        } catch {
            // Corrupt or unavailable storage must never stop the till loading.
            return [];
        }
    });

    useEffect(() => {
        try {
            if (cart.length === 0) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items: cart }));
        } catch {
            /* private mode / quota — the cart still works, it just won't survive */
        }
    }, [key, cart]);

    return [cart, setCart];
}
