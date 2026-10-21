import assert from "node:assert/strict";
import { test } from "node:test";
import { requestDay } from "../src/lib/request-date";

test("dia da solicitação usa Brasília nas viradas de dia, mês e ano", () => {
  assert.equal(requestDay("2026-10-21T02:59:59.999Z"), "2026-10-20");
  assert.equal(requestDay("2026-10-21T03:00:00.000Z"), "2026-10-21");
  assert.equal(requestDay("2026-03-01T02:00:00.000Z"), "2026-02-28");
  assert.equal(requestDay(new Date("2027-01-01T02:00:00.000Z")), "2026-12-31");
});
