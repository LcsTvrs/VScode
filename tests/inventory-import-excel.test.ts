import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseInventoryWorkbook } from "../src/features/inventory/server/import-excel";
import { IMPORT_MAX_BYTES } from "../src/features/inventory/import-types";
import { inventoryWorkbook, type ExcelCell } from "./fixtures/inventory-workbook";

const parse = (rows: ExcelCell[][]) => parseInventoryWorkbook(inventoryWorkbook(rows), "estoque.xlsx");

test("Excel preserva SKU textual, aceita colunas invertidas, agrupa duplicatas e identifica linhas", async () => {
  const items = await parse([[" Quantidade ", " sku "], [2, " cam-m "], [3, "CAM-M"], [null, null], ["4", "00123456"], [1, 123]]);
  assert.deepEqual(items, [
    { sku: "CAM-M", quantity: 5, sourceRows: [2, 3] },
    { sku: "00123456", quantity: 4, sourceRows: [5] },
    { sku: "123", quantity: 1, sourceRows: [6] },
  ]);
});

test("Excel rejeita arquivo vazio, cabeçalhos errados, quantidade inválida e fórmulas", async () => {
  await assert.rejects(parse([["SKU", "Quantidade"]]), /entre 1 e 200/);
  await assert.rejects(parse([["SKU", "SKU", "Quantidade"], ["A", "A", 1]]), /cabeçalhos repetidos/);
  await assert.rejects(parse([["Produto", "Qtd"], ["A", 1]]), /SKU e Quantidade/);
  await assert.rejects(parse([["SKU", "Quantidade"], [null, 1]]), /Linha 2/);
  for (const quantity of [0, -1, 1.5, "1,5", "abc", null, 1_000_001]) {
    await assert.rejects(parse([["SKU", "Quantidade"], ["A", quantity]]), /Linha 2.*inteiro/);
  }
  await assert.rejects(parse([["SKU", "Quantidade"], ["A", 1_000_000], ["A", 1]]), /soma da planilha/);
  await assert.rejects(parse([["SKU", "Quantidade"], ["A", { formula: "1+2", value: 3 }]]), /fórmulas/);
});

test("Excel limita tamanho, linhas, abas e expansão ZIP antes da leitura", async () => {
  await assert.rejects(parseInventoryWorkbook(new Uint8Array(), "vazio.xlsx"), /conteúdo/);
  await assert.rejects(parseInventoryWorkbook(new Uint8Array(IMPORT_MAX_BYTES + 1), "grande.xlsx"), /2 MB/);
  await assert.rejects(parseInventoryWorkbook(new Uint8Array([1, 2]), "arquivo.xls"), /formato .xlsx/);
  await assert.rejects(parseInventoryWorkbook(new Uint8Array([1, 2]), "arquivo.xlsx"), /não foi possível ler/i);
  await assert.rejects(parse([["SKU", "Quantidade"], ...Array.from({ length: 201 }, () => ["A", 1])]), /200 linhas/);
  const multiple = inventoryWorkbook([["SKU", "Quantidade"], ["A", 1]], { "xl/worksheets/sheet2.xml": "<worksheet/>" });
  await assert.rejects(parseInventoryWorkbook(multiple, "abas.xlsx"), /única aba/);
  const bomb = inventoryWorkbook([["SKU", "Quantidade"], ["A", 1]], { "xl/sharedStrings.xml": " ".repeat(9 * 1024 * 1024) });
  await assert.rejects(parseInventoryWorkbook(bomb, "expandido.xlsx"), /muito complexa/);
  const sparse = inventoryWorkbook([], { "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="999999"><c r="A999999"><v>1</v></c></row></sheetData></worksheet>' });
  await assert.rejects(parseInventoryWorkbook(sparse, "esparso.xlsx"), /200 linhas/);
});

test("modelo Excel publicado é legível pelo importador e contém exemplos", async () => {
  const bytes = await readFile("public/modelo-entrada-estoque.xlsx");
  const rows = await parseInventoryWorkbook(bytes, "modelo.xlsx");
  assert.deepEqual(rows.map(({ sku, quantity }) => ({ sku, quantity })), [{ sku: "CAM-AZ-M", quantity: 10 }, { sku: "CAL-PRE-42", quantity: 5 }]);
});
