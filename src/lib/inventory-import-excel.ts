import readXlsxFile from "read-excel-file/universal";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { IMPORT_MAX_BYTES, IMPORT_MAX_QUANTITY, IMPORT_MAX_ROWS, InventoryImportError, type ImportLine } from "./inventory-import-types";

// Limit the expanded ZIP before parsing XML. Repacking uses only the bounded,
// inspected entries, so the reader never expands untrusted ZIP metadata again.
function boundedWorkbook(bytes: Uint8Array) {
  let expanded = 0;
  let entries = 0;
  const files = unzipSync(bytes, { filter: (entry) => {
    expanded += entry.originalSize;
    if (++entries > 100 || expanded > 8 * 1024 * 1024) {
      throw new InventoryImportError("Planilha muito complexa. Use uma única aba com até 200 linhas de dados.");
    }
    if (!/^(?:\[Content_Types\]\.xml|_rels\/|docProps\/|xl\/)/.test(entry.name) || entry.name.includes("..")) {
      throw new InventoryImportError("Estrutura de arquivo Excel inválida.");
    }
    return true;
  } });
  const sheets = Object.keys(files).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name));
  if (sheets.length !== 1 || !files["xl/workbook.xml"]) {
    throw new InventoryImportError("Use um arquivo .xlsx com uma única aba de estoque.");
  }
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
    const xml = strFromU8(content);
    if (/<!DOCTYPE|<!ENTITY|\u0000/i.test(xml)) throw new InventoryImportError("Conteúdo de Excel não suportado.");
    if (name !== sheets[0]) continue;
    if (/<(?:[\w.-]+:)?f(?:\s|\/?>)/i.test(xml)) {
      throw new InventoryImportError("A planilha contém fórmulas. Copie e cole somente os valores antes de importar.");
    }
    let rowCount = 0;
    let cellCount = 0;
    for (const match of xml.matchAll(/<(?:[\w.-]+:)?(row|c)\b([^>]*)>/g)) {
      const isRow = match[1] === "row";
      if (isRow) rowCount++; else cellCount++;
      const ref = /\br\s*=\s*["']([^"']*)["']/.exec(match[2])?.[1];
      const address = ref && (isRow ? /^(\d+)$/.exec(ref) : /^([A-Z]{1,2})(\d+)$/.exec(ref));
      const row = address ? Number(address[isRow ? 1 : 2]) : 0;
      const column = !isRow && address ? [...address[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) : 0;
      if ((ref && (!address || row < 1 || row > IMPORT_MAX_ROWS + 1 || column > 32)) || rowCount > IMPORT_MAX_ROWS + 1 || cellCount > (IMPORT_MAX_ROWS + 1) * 32) {
        throw new InventoryImportError("Use até 200 linhas de dados e 32 colunas, com o cabeçalho na primeira linha. Remova linhas formatadas excedentes.");
      }
      if (isRow && rowCount === 1 && ref && row !== 1) throw new InventoryImportError("Coloque SKU e Quantidade na primeira linha da planilha.");
    }
  }
  return zipSync(files, { level: 0 }).buffer as ArrayBuffer;
}

export async function parseInventoryWorkbook(bytes: Uint8Array, filename: string): Promise<ImportLine[]> {
  if (!/\.xlsx$/i.test(filename)) throw new InventoryImportError("Selecione uma planilha Excel no formato .xlsx.");
  if (!bytes.length || bytes.length > IMPORT_MAX_BYTES) throw new InventoryImportError("O arquivo deve ter conteúdo e no máximo 2 MB.", 413);
  try {
    const sheets = await readXlsxFile(boundedWorkbook(bytes));
    if (sheets.length !== 1) throw new InventoryImportError("Use uma única aba na planilha.");
    const rows = sheets[0].data;
    if (rows.length < 2 || rows.length > IMPORT_MAX_ROWS + 1) throw new InventoryImportError("Informe entre 1 e 200 linhas de dados.");
    const headers = rows[0].map((value) => typeof value === "string" ? value.trim().normalize("NFD").replace(/\p{M}/gu, "").toUpperCase() : "");
    if (headers.filter((h) => h === "SKU").length !== 1 || headers.filter((h) => h === "QUANTIDADE").length !== 1) {
      throw new InventoryImportError("A primeira linha deve conter as colunas SKU e Quantidade, sem cabeçalhos repetidos.");
    }
    const skuColumn = headers.indexOf("SKU");
    const quantityColumn = headers.indexOf("QUANTIDADE");
    const grouped = new Map<string, ImportLine>();
    for (let index = 1; index < rows.length; index++) {
      const row = rows[index];
      if (row.every((cell) => cell === null || cell === "")) continue;
      const rawSku = row[skuColumn];
      const rawQuantity = row[quantityColumn];
      const sku = typeof rawSku === "string" ? rawSku.trim().toUpperCase() : typeof rawSku === "number" && Number.isSafeInteger(rawSku) && rawSku >= 0 ? String(rawSku) : "";
      const quantity = typeof rawQuantity === "number" ? rawQuantity : typeof rawQuantity === "string" && /^\d+$/.test(rawQuantity.trim()) ? Number(rawQuantity.trim()) : NaN;
      if (!sku || sku.length > 40 || /[\x00-\x1f]/.test(sku)) throw new InventoryImportError(`Linha ${index + 1}: informe um SKU válido com até 40 caracteres.`);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > IMPORT_MAX_QUANTITY) {
        throw new InventoryImportError(`Linha ${index + 1} (${sku}): a quantidade deve ser um inteiro entre 1 e 1.000.000.`);
      }
      const item = grouped.get(sku) ?? { sku, quantity: 0, sourceRows: [] };
      item.quantity += quantity;
      item.sourceRows.push(index + 1);
      if (item.quantity > IMPORT_MAX_QUANTITY) throw new InventoryImportError(`SKU ${sku}: a soma da planilha excede 1.000.000.`);
      grouped.set(sku, item);
    }
    if (!grouped.size) throw new InventoryImportError("A planilha não contém itens para importar.");
    return [...grouped.values()];
  } catch (error) {
    if (error instanceof InventoryImportError) throw error;
    throw new InventoryImportError("Não foi possível ler o Excel. Verifique se o arquivo .xlsx está válido e sem senha.");
  }
}
