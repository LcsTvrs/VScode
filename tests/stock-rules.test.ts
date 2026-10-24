import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { movementDelta, assertAvailableStock } from "../src/features/inventory/server/stock-rules";
import { parseStoreLocation } from "../src/features/stores/input";
import { resolveStoreId, type AdminSession } from "../src/features/auth/session";

test("entrada, saída e ajuste mantêm o sinal correto do movimento", () => {
  assert.equal(movementDelta("ENTRADA", 3, 10), 3);
  assert.equal(movementDelta("SAIDA", 3, 10), -3);
  assert.equal(movementDelta("SAIDA", 10, 10), -10);
  assert.equal(movementDelta("AJUSTE", 4, 10), -6);
  assert.equal(movementDelta("AJUSTE", 0, 10), -10);
  assert.throws(() => movementDelta("SAIDA", 11, 10), /SALDO_INSUFICIENTE/);
  for (const invalid of [-1, 0.5, NaN, Infinity, 1_000_001]) {
    assert.throws(() => movementDelta("ENTRADA", invalid, 10), /QUANTIDADE_INVALIDA/);
  }
});

test("pedidos descontam reservas e consultam somente a loja selecionada", async () => {
  const tx = {
    stockLevel: { findMany: async (args: { where: { storeId: string } }) => {
      assert.equal(args.where.storeId, "loja-a");
      return [{ variantId: "camisa", quantity: 10 }];
    } },
    requestItem: { groupBy: async (args: { where: { request: { storeId: string; status: string } } }) => {
      assert.deepEqual(args.where.request, { storeId: "loja-a", status: "PENDENTE" });
      return [{ variantId: "camisa", _sum: { quantity: 7 } }];
    } },
  } as unknown as Prisma.TransactionClient;
  await assertAvailableStock(tx, "loja-a", new Map([["camisa", 3]]));
  await assert.rejects(assertAvailableStock(tx, "loja-a", new Map([["camisa", 4]])), /ESTOQUE_INSUFICIENTE/);
  await assert.rejects(assertAvailableStock(tx, "loja-a", new Map([["outra-loja", 1]])), /ESTOQUE_INSUFICIENTE/);
});

test("STORE_ADMIN não amplia escopo usando o storeId do navegador", () => {
  const session = { role: "STORE_ADMIN", storeId: "loja-a" } as AdminSession;
  assert.equal(resolveStoreId(session, "loja-b"), "loja-a");
  assert.equal(resolveStoreId({ ...session, role: "MASTER_ADMIN" }, "loja-b"), "loja-b");
});

test("localização exige cidade e UF reais no cadastro e edição", () => {
  assert.deepEqual(parseStoreLocation({ city: " São  Paulo ", state: "sp" }), { city: "São Paulo", state: "SP" });
  assert.equal(parseStoreLocation({ city: "Cidade", state: "NA" }), null);
  assert.equal(parseStoreLocation({ city: "", state: "SP" }), null);
  assert.equal(parseStoreLocation({ name: "Loja" }), null);
});
