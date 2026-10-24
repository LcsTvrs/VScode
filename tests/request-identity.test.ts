import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRequestIdentity } from "../src/features/requests/identity";

test("LDAP exige texto com oito dígitos e preserva zeros iniciais", () => {
  assert.deepEqual(validateRequestIdentity("00123456", "Ana Maria"), { ok: true, ldap: "00123456", name: "Ana Maria" });
  for (const ldap of ["", "1234567", "123456789", "1234567a", "1234-678", "1234 678", " 12345678", "12345678\n", "１２３４５６７８", 12345678, null]) {
    const result = validateRequestIdentity(ldap, "Ana Maria");
    assert.equal(result.ok, false, `LDAP inválido: ${JSON.stringify(ldap)}`);
  }
});

test("nome aceita letras, acentos e espaços sem limite de comprimento", () => {
  assert.deepEqual(validateRequestIdentity("12345678", "  Joa\u0303o   Conceição  "), { ok: true, ldap: "12345678", name: "João Conceição" });
  for (const name of ["É", "José Luís", "李 明", "Ana ".repeat(1000).trim()]) {
    const result = validateRequestIdentity("12345678", name);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.name, name);
  }
});

test("nome rejeita números, pontuação, símbolos e controles", () => {
  for (const name of ["", "   ", "Ana2", "Ana-Maria", "D'Ávila", "Ana🙂", "<Ana>", "Ana\n", "Ana\tMaria", "\u0301Ana", "Ana \u0301", null, 123]) {
    assert.equal(validateRequestIdentity("12345678", name).ok, false, `Nome inválido: ${JSON.stringify(name)}`);
  }
});
