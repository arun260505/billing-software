import React from "react";

function CategoryTabs({ categories, selectedCategory, onSelectCategory }) {
    return (
        <div className="category-tabs">
            {categories.map((category) => (
                <button
                    key={category.id}
                    onClick={() => onSelectCategory(category.id)}
                    className={
                        selectedCategory === category.id
                            ? "active-category"
                            : ""
                    }
                >
                    {category.category_name}
                </button>
            ))}
        </div>
    );
}

export default CategoryTabs;