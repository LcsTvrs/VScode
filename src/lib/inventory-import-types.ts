export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_QUANTITY = 1_000_000;

export type ImportLine = { sku: string; quantity: number; sourceRows: number[] };
export type ImportPreviewRow = ImportLine & {
  variantId: string | null;
  name: string;
  category: string;
  size: string;
  color: string;
  currentQuantity: number | null;
  finalQuantity: number | null;
  error: string | null;
};
export type ImportPreview = {
  rows: ImportPreviewRow[];
  token: string | null;
  expiresAt: string | null;
  totalQuantity: number;
};

export class InventoryImportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
