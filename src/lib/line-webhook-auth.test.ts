import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { identifyChannel } from "./line-webhook-auth";

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64");
const body = JSON.stringify({ events: [] });

test("既存(default)の秘密文字列の署名は default と判定する", () => {
  const env = { LINE_CHANNEL_SECRET: "secret-default", LINE_CHANNEL_SECRET_MANAGER: "secret-manager" };
  assert.deepEqual(identifyChannel(body, sign(body, "secret-default"), env), { configured: true, channel: "default" });
});

test("manager の秘密文字列の署名は manager と判定する", () => {
  const env = { LINE_CHANNEL_SECRET: "secret-default", LINE_CHANNEL_SECRET_MANAGER: "secret-manager" };
  assert.deepEqual(identifyChannel(body, sign(body, "secret-manager"), env), { configured: true, channel: "manager" });
});

test("どちらにも一致しない署名・署名なしは null(401にする)", () => {
  const env = { LINE_CHANNEL_SECRET: "secret-default", LINE_CHANNEL_SECRET_MANAGER: "secret-manager" };
  assert.deepEqual(identifyChannel(body, sign(body, "other"), env), { configured: true, channel: null });
  assert.deepEqual(identifyChannel(body, null, env), { configured: true, channel: null });
});

test("本文が改ざんされた署名は一致しない", () => {
  const env = { LINE_CHANNEL_SECRET: "secret-default" };
  assert.equal(identifyChannel(`${body} `, sign(body, "secret-default"), env).channel, null);
});

test("manager の秘密文字列が未設定でも、既存(default)は従来どおり動く", () => {
  const env = { LINE_CHANNEL_SECRET: "secret-default" };
  assert.deepEqual(identifyChannel(body, sign(body, "secret-default"), env), { configured: true, channel: "default" });
  assert.deepEqual(identifyChannel(body, sign(body, "secret-manager"), env), { configured: true, channel: null });
});

test("秘密文字列が1つも未設定なら configured=false(503にする)", () => {
  assert.deepEqual(identifyChannel(body, sign(body, "x"), {}), { configured: false, channel: null });
  assert.deepEqual(identifyChannel(body, sign(body, "x"), { LINE_CHANNEL_SECRET: "" }), { configured: false, channel: null });
});
