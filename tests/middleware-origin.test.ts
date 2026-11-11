import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";

test("origin validation uses the browser host when Next normalizes loopback URLs", async () => {
  for (const host of ["127.0.0.1:3000", "localhost:3000", "[::1]:3000"]) {
    const response = await middleware(new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST", headers: { Host: host, Origin: `http://${host}`, "Sec-Fetch-Site": "same-origin" },
    }));
    assert.equal(response.headers.get("x-middleware-next"), "1", host);
  }
});

test("origin validation rejects external origins, mismatched ports, schemes and cross-site writes", async () => {
  for (const origin of ["https://evil.example", "null", "http://127.0.0.1:3001", "https://127.0.0.1:3000", "http://localhost:3000"]) {
    const response = await middleware(new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST", headers: { Host: "127.0.0.1:3000", Origin: origin },
    }));
    assert.equal(response.status, 403, origin);
  }
  const response = await middleware(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Sec-Fetch-Site": "cross-site" },
  }));
  assert.equal(response.status, 403);
});

test("production HTTPS and public reads retain their origin behavior", async () => {
  const response = await middleware(new NextRequest("https://app.example/api/auth/login", {
    method: "POST", headers: { Host: "app.example", Origin: "https://app.example" },
  }));
  assert.equal(response.headers.get("x-middleware-next"), "1");
  const image = await middleware(new NextRequest("https://app.example/api/uniform-images/photo"));
  assert.equal(image.headers.get("x-middleware-next"), "1");
});
