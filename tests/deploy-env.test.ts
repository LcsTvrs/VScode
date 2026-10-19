import assert from "node:assert/strict";
import { test } from "node:test";
import { deploymentEnvironmentErrors } from "../scripts/lib/deploy-env";

const validEnv = {
  DATABASE_URL: "postgresql://user:placeholder@database.example/inventory",
  DIRECT_URL: "postgresql://user:placeholder@database.example/inventory",
  ADMIN_SESSION_SECRET: "test-secret-with-at-least-32-bytes-long",
};

test("deploy exige conexões e chave de sessão; senha de provisionamento é opcional", () => {
  assert.deepEqual(deploymentEnvironmentErrors(validEnv), []);
  assert.equal(deploymentEnvironmentErrors({}).length, 3);
  assert.equal(deploymentEnvironmentErrors({ ...validEnv, ADMIN_SESSION_SECRET: "curta" }).length, 1);
  assert.equal(deploymentEnvironmentErrors({ ...validEnv, ADMIN_PASSWORD: "curta" }).length, 1);
});

test("deploy recusa URL inválida e localhost na Vercel sem revelar segredos", () => {
  const secretValue = "not-a-url-with-private-password";
  const errors = deploymentEnvironmentErrors({ ...validEnv, DATABASE_URL: secretValue });
  assert.equal(errors.length, 1);
  assert.ok(errors.every((error) => !error.includes(secretValue)));
  assert.equal(deploymentEnvironmentErrors({ ...validEnv, DIRECT_URL: "https://database.example/inventory" }).length, 1);
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(deploymentEnvironmentErrors({ ...validEnv, VERCEL: "1", DATABASE_URL: `postgresql://user:placeholder@${hostname}/inventory` }).length, 1);
  }
  assert.deepEqual(deploymentEnvironmentErrors({ ...validEnv, DATABASE_URL: "postgresql://user:placeholder@localhost/inventory" }), []);
});
