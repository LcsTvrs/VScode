export type BulkChange = { mode: "KEEP" | "SET" | "ADD" | "REMOVE"; quantity?: number; minimum?: number };
export type BulkRecord = { storeId: string; variantId: string; updatedAt: string };

export function validStockNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

export function parseBulkInput(input: unknown): { records: BulkRecord[]; change: BulkChange } {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos.");
  const { records, change } = input as { records?: unknown; change?: unknown };
  if (!Array.isArray(records) || !records.length || records.length > 200 || !change || typeof change !== "object") throw new Error("Selecione de 1 a 200 registros e informe a alteração.");
  const patch = change as BulkChange;
  if (!["KEEP", "SET", "ADD", "REMOVE"].includes(patch.mode) || (patch.mode !== "KEEP" && !validStockNumber(patch.quantity)) || (patch.minimum !== undefined && !validStockNumber(patch.minimum)) || (patch.mode === "KEEP" && (patch.minimum === undefined || patch.quantity !== undefined))) throw new Error("Informe saldo e/ou mínimo válidos e escolha como alterar o saldo.");
  const seen = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object" || typeof record.storeId !== "string" || !record.storeId || typeof record.variantId !== "string" || !record.variantId || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) throw new Error("Cada registro deve informar loja, uniforme e versão do estoque.");
    const key = JSON.stringify([record.storeId, record.variantId]);
    if (seen.has(key)) throw new Error("Há registros repetidos na seleção.");
    seen.add(key);
  }
  return { records, change: patch };
}

export function bulkResult(quantity: number, minimum: number, change: BulkChange) {
  const next = change.mode === "SET" ? change.quantity! : change.mode === "ADD" ? quantity + change.quantity! : change.mode === "REMOVE" ? quantity - change.quantity! : quantity;
  if (!validStockNumber(next)) throw new Error("O saldo final de cada registro deve ficar entre zero e 1.000.000.");
  return { quantity: next, minimum: change.minimum ?? minimum };
}
