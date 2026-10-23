import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { databaseEnvironment } from "../src/lib/database-environment";

const productionHost = "ep-production.example.neon.tech";
const baseline = {
  VERCEL_ENV: "preview",
  PREVIEW_PRODUCTION_ENDPOINT_SHA256: createHash("sha256").update(productionHost).digest("hex"),
  DIRECT_DATABASE_URL: "postgresql://test:placeholder@ep-preview-pooler.example.neon.tech/neondb",
  DIRECT_DATABASE_URL_UNPOOLED: "postgresql://test:placeholder@ep-preview.example.neon.tech/neondb",
};

test("Preview usa apenas URLs da integração e recusa fallback manual de produção", () => {
  const result = databaseEnvironment({ ...baseline, DATABASE_URL: "production-url", DIRECT_URL: "production-direct" });
  assert.equal(result.DATABASE_URL, baseline.DIRECT_DATABASE_URL);
  assert.equal(result.DIRECT_URL, baseline.DIRECT_DATABASE_URL_UNPOOLED);
  assert.throws(() => databaseEnvironment({ ...baseline, DIRECT_DATABASE_URL: undefined, DATABASE_URL: "production-url" }));
  assert.throws(() => databaseEnvironment({ ...baseline, DIRECT_DATABASE_URL_UNPOOLED: undefined }));
  assert.throws(() => databaseEnvironment({ ...baseline, PREVIEW_PRODUCTION_ENDPOINT_SHA256: undefined }));
});

test("Preview rejeita produção, destinos divergentes e URLs inválidas sem exibir credenciais", () => {
  assert.throws(() => databaseEnvironment({ ...baseline,
    DIRECT_DATABASE_URL: `postgresql://test:private@${productionHost.replace(".example", "-pooler.example")}/neondb`,
    DIRECT_DATABASE_URL_UNPOOLED: `postgresql://test:private@${productionHost}/neondb`,
  }), /endpoint de produção/);
  assert.throws(() => databaseEnvironment({ ...baseline, DIRECT_DATABASE_URL_UNPOOLED: "postgresql://test:private@ep-other.example.neon.tech/neondb" }), /mesmo endpoint/);
  for (const value of ["private-secret", "https://test:private@ep-preview.example.neon.tech/neondb", "postgresql://test:private@localhost/neondb"]) {
    assert.throws(() => databaseEnvironment({ ...baseline, DIRECT_DATABASE_URL: value }), error => error instanceof Error && !error.message.includes("private"));
  }
});

test("produção e desenvolvimento mantêm suas próprias variáveis sem exigir Neon", () => {
  for (const VERCEL_ENV of ["production", "development", undefined]) {
    const env = { VERCEL_ENV, DATABASE_URL: "local-or-production", DIRECT_URL: "direct" };
    assert.equal(databaseEnvironment(env), env);
  }
});
