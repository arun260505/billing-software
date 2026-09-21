import React, { useEffect, useRef } from "react";

function CategoryTabs({ categories, selectedCategory, onSelectCategory }) {

    // The strip scrolls horizontally, so a selected category that sits past the
    // right edge stayed half cut-off and you could not read which one was active.
    // Scroll the active chip fully into view (centred) whenever the selection
    // changes. block:"nearest" keeps the page from jumping vertically.
    const activeRef = useRef(null);
    useEffect(() => {
        const el = activeRef.current;
        if (el && typeof el.scrollIntoView === "function") {
            try {
                el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
            } catch {
                el.scrollIntoView();
            }
        }
    }, [selectedCategory]);

    return (
        <div className="category-tabs">
            {categories.map((category) => {
                const isActive = selectedCategory === category.id;
                return (
                    <button
                        key={category.id}
                        ref={isActive ? activeRef : null}
                        onClick={() => onSelectCategory(category.id)}
                        className={isActive ? "active-category" : ""}
                    >
                        {isActive && <span className="tab-star">★ </span>}
                        {category.category_name}
                    </button>
                );
            })}
        </div>
    );
}

export default CategoryTabs;
