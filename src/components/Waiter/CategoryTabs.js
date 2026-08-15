import React from "react";

function CategoryTabs({ categories, selectedCategory, onSelectCategory }) {
    return (
        <div className="category-tabs">
            {categories.map((category, index) => (
                <button
                    key={category.id}
                    onClick={() => onSelectCategory(category.id)}
                    className={
                        selectedCategory === category.id
                            ? "active-category"
                            : ""
                    }
                >
                    {selectedCategory === category.id && (
                        <span className="tab-star">★ </span>
                    )}
                    {category.category_name}
                </button>
            ))}
        </div>
    );
}

export default CategoryTabs;