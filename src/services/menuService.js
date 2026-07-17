import api from "./api";

export const getCategories = () =>
  api.get("/menu/categories");

export const getAllItems = () =>
  api.get("/menu/items");

export const getItemsByCategory = (id) =>
  api.get(`/menu/items/category/${id}`);