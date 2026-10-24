// Loaded only by the Playwright web server. Administrative layouts render on
// the server, so browser route mocks cannot intercept their session lookup.
// All other database access fails: browser tests must mock API responses.
const unavailable = () => { throw new Error("Browser tests must not access a database. Mock the API response."); };
const blockedModel = new Proxy({}, { get: () => unavailable });
globalThis.prisma = new Proxy({
  user: new Proxy({
    findUnique: async ({ where }) => where.id === "master" ? {
      login: "master", name: "Master teste", role: "MASTER_ADMIN", storeId: null,
      mustChangePassword: false, passwordChangeDeadline: null,
      updatedAt: new Date("2026-10-23T12:00:00Z"),
    } : null,
  }, { get: (target, key) => key in target ? target[key] : unavailable }),
}, { get: (target, key) => key in target ? target[key] : blockedModel });
