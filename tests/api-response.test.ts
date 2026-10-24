import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiResponseError, readApiResponse } from "../src/lib/api-response";

test("respostas de conflito preservam status e código para permitir atualização da tela", async () => {
  await assert.rejects(
    readApiResponse(Response.json({ message: "Dados alterados.", code: "REQUEST_CHANGED" }, { status: 409 }), "Falha."),
    (error: unknown) => error instanceof ApiResponseError && error.status === 409 && error.code === "REQUEST_CHANGED" && error.message === "Dados alterados.",
  );
});
test("resposta sem conteúdo permite exclusão; HTML e 429 recebem orientação legível", async () => {
  assert.equal(await readApiResponse<void>(new Response(null, { status: 204 }), "Falha."), undefined);
  await assert.rejects(readApiResponse(new Response("<html>Proxy</html>", { status: 502 }), "Confira antes de repetir."), { message: "Confira antes de repetir." });
  await assert.rejects(readApiResponse(new Response("<html>Firewall</html>", { status: 429 }), "Falha."), /Aguarde um minuto/);
});
