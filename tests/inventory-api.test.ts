import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createAdminSession, ADMIN_SESSION_COOKIE } from "../src/features/auth/session";
import { POST } from "../src/app/api/inventory/route";
import { POST as createRequest } from "../src/app/api/requests/route";

// Prisma exposes methods through a proxy; replace values without descriptor-based mocks.
const restores: Array<() => void> = [];
const mock = {
  method(target: object, name: string, replacement: unknown) {
    const object = target as Record<string, unknown>;
    const original = object[name];
    object[name] = replacement;
    restores.push(() => { object[name] = original; });
  },
  restoreAll() { while (restores.length) restores.pop()!(); },
};

test("API de estoque registra saídas negativas e rejeita conflitos sem gravar movimento", async () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "test-secret-with-at-least-32-bytes-long";
  const updatedAt = new Date();
  const session = { userId: "admin", login: "admin", role: "STORE_ADMIN" as const, storeId: "loja-a", mustChangePassword: false, userUpdatedAt: updatedAt.getTime() };
  const token = await createAdminSession(session);
  mock.method(prisma, "$executeRawUnsafe", async () => 0);
  mock.method(prisma.user, "findUnique", async () => ({ ...session, updatedAt, name: "Admin" }));
  let balance = 10;
  let conflict = false;
  const movements: number[] = [];
  const tx = {
    requestItem: { aggregate: async () => ({ _sum: { quantity: 0 } }) },
    stockLevel: {
      findUnique: async ({ where }: { where: { storeId_variantId: { storeId: string } } }) => {
        assert.equal(where.storeId_variantId.storeId, "loja-a");
        return { id: "stock", quantity: balance };
      },
      updateMany: async ({ where, data }: { where: { quantity: number }; data: { quantity: number } }) => {
        assert.equal(where.quantity, balance);
        if (conflict) return { count: 0 };
        balance = data.quantity;
        return { count: 1 };
      },
    },
    stockMovement: { create: async ({ data }: { data: { quantity: number } }) => { movements.push(data.quantity); return { id: "movement" }; } },
  };
  mock.method(prisma, "$transaction", async (callback: (client: typeof tx) => unknown) => callback(tx));
  const request = (type: string, quantity: number) => new Request("http://localhost/api/inventory", {
    method: "POST", headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: "loja-b", variantId: "camisa", type, quantity }),
  });
  try {
    assert.equal((await POST(request("SAIDA", 3))).status, 201);
    assert.equal(balance, 7);
    assert.deepEqual(movements, [-3]);
    assert.equal((await POST(request("SAIDA", 8))).status, 409);
    assert.equal(balance, 7);
    conflict = true;
    assert.equal((await POST(request("ENTRADA", 2))).status, 409);
    assert.deepEqual(movements, [-3]);
    assert.equal((await POST(request("ENTRADA", 1_000_001))).status, 400);
  } finally {
    mock.restoreAll();
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test("pedido administrativo exige transação serializável e retorna 409 em conflito", async () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "test-secret-with-at-least-32-bytes-long";
  const updatedAt = new Date();
  const session = { userId: "admin", login: "admin", role: "STORE_ADMIN" as const, storeId: "loja-a", mustChangePassword: false, userUpdatedAt: updatedAt.getTime() };
  const token = await createAdminSession(session);
  mock.method(prisma.user, "findUnique", async () => ({ ...session, updatedAt, name: "Admin" }));
  mock.method(prisma, "$transaction", async (_callback: unknown, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "Serializable" });
    throw Object.assign(new Error("write conflict"), { code: "P2034" });
  });
  try {
    const response = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST", headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: "employee", items: [{ variantId: "camisa", quantity: 1 }] }),
    }));
    assert.equal(response.status, 409);
  } finally {
    mock.restoreAll();
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
