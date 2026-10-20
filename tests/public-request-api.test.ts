import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { POST } from "../src/app/api/requests/public/route";

test("API pública rejeita identidade inválida antes de acessar o banco e aceita nome longo", async () => {
  // Replace proxy methods directly; no database connection is made by this test.
  const originalFindStore = prisma.store.findUnique;
  const originalTransaction = prisma.$transaction;
  let storeReads = 0;
  let employeeData: unknown;
  const longName = "José ".repeat(100).trim();
  const tx = {
    stockLevel: { findMany: async () => [{ variantId: "camisa", quantity: 10 }] },
    requestItem: { groupBy: async () => [] },
    employee: { upsert: async (args: unknown) => { employeeData = args; return { id: "employee" }; } },
    uniformRequest: { create: async () => ({ id: "request", code: "SOL-TEST", status: "PENDENTE" }) },
  };
  prisma.store.findUnique = (async () => { storeReads++; return { id: "loja", code: "0012", name: "Loja" }; }) as unknown as typeof originalFindStore;
  prisma.$transaction = (async (callback: (client: typeof tx) => unknown) => callback(tx)) as unknown as typeof originalTransaction;
  const request = (ldap: unknown, name: unknown, items: unknown = [{ variantId: "camisa", quantity: 1 }]) => new Request("http://localhost/api/requests/public", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ldap, name, storeCode: "0012", items }),
  });
  try {
    for (const ldap of ["ana.silva", "1234567", "123456789", 12345678]) {
      const response = await POST(request(ldap, "Ana Silva"));
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /LDAP/);
    }
    for (const name of ["Ana2", "Ana-Maria", "", "Ana\n"] ) {
      const response = await POST(request("00123456", name));
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /nome completo/);
    }
    assert.equal(storeReads, 0);
    for (const quantity of [4, 20, 0, -1, 1.5, "3"]) {
      assert.equal((await POST(request("00123456", "Ana Silva", [{ variantId: "camisa", quantity }]))).status, 400);
    }
    assert.equal((await POST(request("00123456", "Ana Silva", [{ variantId: "camisa", quantity: 2 }, { variantId: "camisa", quantity: 2 }]))).status, 400);
    assert.equal(storeReads, 0, "quantidades inválidas não consultam nem alteram o banco");
    assert.equal((await POST(request("00123456", "Ana Silva", [{ variantId: "camisa", quantity: 1 }, { variantId: "camisa", quantity: 2 }]))).status, 201);
    const response = await POST(request("00123456", longName));
    assert.equal(response.status, 201);
    assert.deepEqual(employeeData, {
      where: { storeId_ldap: { storeId: "loja", ldap: "00123456" } },
      create: { ldap: "00123456", name: longName, storeId: "loja" },
      update: { name: longName, storeId: "loja" },
      select: { id: true },
    });
  } finally {
    prisma.store.findUnique = originalFindStore;
    prisma.$transaction = originalTransaction;
  }
});
