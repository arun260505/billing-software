import { useEffect } from "react";

/**
 * Close a modal on the Escape key.
 *
 * Every modal here could be dismissed by clicking the overlay or the ✕, but not
 * from the keyboard — which is the one route a cashier working at speed on a
 * till actually reaches for, and the first thing anyone tries on a desktop.
 *
 * Bound on `keydown` at the document, and only while `active` is true, so the
 * listener exists exactly as long as the modal does. When several modals are
 * stacked the innermost one mounts last, so it handles the key first and calls
 * `stopPropagation` on the event — closing one layer per press rather than all
 * of them at once.
 *
 * @param {Function} onClose  called when Escape is pressed
 * @param {boolean}  active   set false to disable (e.g. while a save is in flight)
 */
export default function useEscapeClose(onClose, active = true) {

    useEffect(() => {

        if (!active || typeof onClose !== "function") return undefined;

        const onKeyDown = (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onClose();
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);

    }, [onClose, active]);

}
