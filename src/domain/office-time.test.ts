import assert from "node:assert/strict";
import test from "node:test";
import { officeTime, readTimeZone } from "./office-time";
import { readSharedScene } from "./office-share";

test("clock converts one instant across valid IANA zones and discards invalid zones", () => {
  const instant = new Date("2026-09-30T12:30:45Z");
  assert.equal(officeTime(instant, "America/Sao_Paulo"), "09:30:45");
  assert.equal(officeTime(instant, "Asia/Tokyo"), "21:30:45");
  assert.equal(readTimeZone("invalid/zone"), undefined);
  const base = { hostName: "Ana", localOffline: false, rooms: [], agents: [] };
  assert.equal(readSharedScene({ ...base, hostTimeZone: "Asia/Tokyo" })?.hostTimeZone, "Asia/Tokyo");
  assert.equal(readSharedScene({ ...base, hostTimeZone: "invalid/zone" })?.hostTimeZone, undefined);
});
