import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/features/auth/session";
import { dayBoundary, historyQuery } from "../src/features/requests/server/history";
import { GET as history } from "../src/app/api/requests/route";
import { GET as employees } from "../src/app/api/employees/route";

test("período usa dias de Brasília, inclusive limites e horário de verão histórico", () => {
  assert.equal(dayBoundary("2026-10-20").toISOString(), "2026-10-20T03:00:00.000Z");
  assert.equal(dayBoundary("2018-11-04").toISOString(), "2018-11-04T03:00:00.000Z");
  assert.equal(dayBoundary("2018-11-05").toISOString(), "2018-11-05T02:00:00.000Z");
  const query = historyQuery(new URLSearchParams("start=2026-10-20&end=2026-10-21&status=PENDENTE&search=00123456&page=2"), "a");
  assert.deepEqual(query.where.createdAt, { gte: new Date("2026-10-20T03:00:00Z"), lt: new Date("2026-10-22T03:00:00Z") });
  assert.equal(query.where.storeId, "a"); assert.equal(query.page, 2);
  for (const input of ["start=2026-02-30", "end=abc", "start=2026-10-21&end=2026-10-20", "page=0", "page=1.5", "page=1000001", "status=OUTRO", `search=${"a".repeat(121)}`]) {
    assert.throws(() => historyQuery(new URLSearchParams(input), "a"));
  }
});

test("histórico paginado e colaboradores revalidam perfil e loja sem limitar totais", async () => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "history-test-secret-with-at-least-32-bytes";
  const time = new Date("2026-10-30T12:00:00Z");
  const session: AdminSession = { userId: "master", login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) { const obj = target as Record<string, unknown>, old = obj[key]; obj[key] = value; restores.push(() => { obj[key] = old; }); }
  replace(prisma.user, "findUnique", async () => ({ ...session, updatedAt: time }));
  const countQueries: unknown[] = [], pageQueries: Record<string, unknown>[] = [], employeeQueries: unknown[] = [];
  replace(prisma, "$transaction", async (callback: (tx: object) => unknown, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "RepeatableRead");
    return callback({ uniformRequest: {
      count: async (input: unknown) => { countQueries.push(input); return 61; },
      findMany: async (input: Record<string, unknown>) => { pageQueries.push(input); return []; },
    } });
  });
  replace(prisma.employee, "findMany", async (input: unknown) => { employeeQueries.push(input); return []; });
  async function request(path: string) { return new Request(`https://app.example${path}`, { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` } }); }
  try {
    assert.equal((await history(new Request("https://app.example/api/requests"))).status, 401);
    assert.equal((await employees(new Request("https://app.example/api/employees"))).status, 401);
    const all = await (await history(await request("/api/requests?page=2"))).json();
    assert.deepEqual({ total: all.total, filteredTotal: all.filteredTotal, pages: all.pages, page: all.page }, { total: 61, filteredTotal: 61, pages: 3, page: 2 });
    assert.deepEqual(countQueries[0], { where: {} });
    assert.equal(pageQueries[0].take, 25); assert.equal(pageQueries[0].skip, 25);
    const last = await (await history(await request("/api/requests?page=999"))).json();
    assert.equal(last.page, 3); assert.equal(pageQueries[1].skip, 50);
    session.role = "STORE_ADMIN"; session.storeId = "a";
    await history(await request("/api/requests?storeId=b&status=APROVADA&search=Ana"));
    assert.deepEqual(countQueries[4], { where: { storeId: "a" } });
    assert.deepEqual(pageQueries[2].where, { storeId: "a", status: "APROVADA", employee: { OR: [{ name: { contains: "Ana", mode: "insensitive" } }, { ldap: { contains: "Ana" } }] } });
    await employees(await request("/api/employees?storeId=b"));
    assert.deepEqual(employeeQueries[0], { where: { storeId: "a" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, ldap: true, email: true, storeId: true } });
    session.mustChangePassword = true;
    assert.equal((await history(await request("/api/requests"))).status, 403);
    assert.equal((await employees(await request("/api/employees"))).status, 403);
    session.mustChangePassword = false; session.storeId = null;
    assert.equal((await history(await request("/api/requests?storeId=b"))).status, 401);
    assert.equal((await employees(await request("/api/employees?storeId=b"))).status, 401);
    session.role = "MASTER_ADMIN";
    assert.equal((await employees(await request("/api/employees"))).status, 400);
    assert.equal(pageQueries.length, 3); assert.equal(employeeQueries.length, 1);
  } finally { while (restores.length) restores.pop()!(); if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret; }
});
