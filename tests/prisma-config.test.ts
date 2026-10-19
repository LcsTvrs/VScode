import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfigFromFile } from "@prisma/config";

test("Prisma carrega configuração com a dependência deepmerge corrigida", async () => {
  const directory = mkdtempSync(join(tmpdir(), "uniformes-prisma-config-"));
  const file = join(directory, "prisma.config.mjs");
  try {
    writeFileSync(file, 'export default { schema: "schema.prisma", migrations: { path: "migrations", seed: "tsx prisma/seed.ts" } };');
    const result = await loadConfigFromFile({ configFile: file, configRoot: directory });
    assert.equal(result.error, undefined);
    assert.equal(result.config?.schema, join(directory, "schema.prisma"));
    assert.equal(result.config?.migrations?.path, join(directory, "migrations"));
    assert.equal(result.config?.migrations?.seed, "tsx prisma/seed.ts");
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
});
