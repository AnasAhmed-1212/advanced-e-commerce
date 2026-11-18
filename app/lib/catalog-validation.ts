import { CommerceError } from "./api-errors";
import { slugify, UUID_PATTERN, type CategoryInput, type ProductInput, type ProductStatus } from "./catalog-types";
function text(body: Record<string, unknown>, key: string, max: number) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (value.length > max) throw new CommerceError(`${key} is too long (maximum ${max} characters).`);
  return value;
}
function slug(body: Record<string, unknown>, name: string) {
  const value = text(body, "slug", 120) || slugify(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new CommerceError("Enter a valid URL slug using letters, numbers and hyphens.");
  return value;
}
export function categoryInput(body: Record<string, unknown>): CategoryInput {
  const name = text(body, "name", 100);
  if (!name) throw new CommerceError("Category name is required.");
  const imageId = body.imageId || null;
  if (imageId !== null && (typeof imageId !== "string" || !UUID_PATTERN.test(imageId))) throw new CommerceError("Choose a valid category image.");
  if (typeof body.isActive !== "boolean") throw new CommerceError("Choose the category visibility.");
  return { name, slug: slug(body, name), description: text(body, "description", 5000), imageId, isActive: body.isActive };
}
export function productInput(body: Record<string, unknown>, editing = false): ProductInput {
  const title = text(body, "title", 160);
  if (!title) throw new CommerceError("Product name is required.");
  const categoryId = text(body, "categoryId", 36);
  if (!UUID_PATTERN.test(categoryId)) throw new CommerceError("Select a category for this product.");
  if (typeof body.priceMinor !== "number" || !Number.isSafeInteger(body.priceMinor) || body.priceMinor < 0 || body.priceMinor > 10000000000) throw new CommerceError("Enter a valid price.");
  const previousPriceMinor = body.previousPriceMinor;
  if (previousPriceMinor != null && (typeof previousPriceMinor !== "number" || !Number.isSafeInteger(previousPriceMinor) || previousPriceMinor <= body.priceMinor || previousPriceMinor > 10000000000)) {
    throw new CommerceError("The previous price must be higher than the current price and at most PKR 100,000,000.");
  }
  if (typeof body.onHand !== "number" || !Number.isSafeInteger(body.onHand) || body.onHand < 0 || body.onHand > 1000000) throw new CommerceError("Stock must be a whole number between 0 and 1,000,000.");
  const status = body.status as ProductStatus;
  if (!["draft", "published", "archived"].includes(status)) throw new CommerceError("Choose a valid product status.");
  if (!Array.isArray(body.imageIds) || body.imageIds.length > 10 || body.imageIds.some(id => typeof id !== "string" || !UUID_PATTERN.test(id)) || new Set(body.imageIds).size !== body.imageIds.length) throw new CommerceError("Choose up to 10 unique product images.");
  const description = text(body, "description", 20000);
  if (status === "published" && (!body.imageIds.length || !description)) throw new CommerceError("Add a description and at least one image before publishing.");
  if (editing && (typeof body.version !== "number" || !Number.isSafeInteger(body.version) || body.version < 1)) throw new CommerceError("Reload this product before editing.");
  return { title, slug: slug(body, title), description, categoryId, priceMinor: body.priceMinor, previousPriceMinor, onHand: body.onHand, status, imageIds: body.imageIds as string[], version: editing ? body.version as number : undefined };
}
