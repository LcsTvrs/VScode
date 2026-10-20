export const PUBLIC_ITEM_LIMIT = 3;
export const ADMIN_ITEM_LIMIT = 20;
export const REQUEST_LINE_LIMIT = 20;

export function parseRequestItems(items: unknown, limit: number): Map<string, number> {
  if (!Array.isArray(items) || !items.length || items.length > REQUEST_LINE_LIMIT) {
    throw new Error(`Informe entre 1 e ${REQUEST_LINE_LIMIT} itens na solicitação.`);
  }
  const aggregated = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.variantId !== "string" || !item.variantId.trim() ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > limit) {
      throw new Error(`Cada item deve ter uma quantidade inteira entre 1 e ${limit} unidades.`);
    }
    const quantity = (aggregated.get(item.variantId) ?? 0) + item.quantity;
    if (quantity > limit) throw new Error(`A quantidade por item não pode passar de ${limit} unidades, incluindo linhas repetidas.`);
    aggregated.set(item.variantId, quantity);
  }
  return aggregated;
}
