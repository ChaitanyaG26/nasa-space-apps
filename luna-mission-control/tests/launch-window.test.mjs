import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_SITES, moonPosition, moonBearing,
  transferEstimate, parseHolds, searchWindows
} from "../web/launch-window.mjs";

const KSC = LAUNCH_SITES.find(s => s.id === "ksc");
const TARGET = Date.parse("2026-11-25T12:00:00Z");

test("Only the three selected primary U.S. launch ranges are available", () => {
  assert.deepEqual(LAUNCH_SITES.map(s => s.id), ["ksc", "ccsfs", "vandenberg"]);
  assert.ok(KSC);
  assert.equal(LAUNCH_SITES.length, 3);
  for (const s of LAUNCH_SITES) {
    assert.ok(s.lat >= -90 && s.lat <= 90);
    assert.ok(s.lon >= -180 && s.lon <= 180);
  }
});
test("Lunar position and transfer are finite, plausibly scaled illustrations", () => {
  const p = moonPosition(TARGET);
  assert.ok(p.distanceKm > 340000 && p.distanceKm < 410000);
  assert.ok(p.dec > -35 && p.dec < 35);
  const b = moonBearing(KSC,TARGET);
  assert.ok(b.az >= 0 && b.az < 360);
  assert.ok(b.el >= -90 && b.el <= 90);
  const tr = transferEstimate(KSC,TARGET,200);
  assert.ok(tr.flightDays > 3 && tr.flightDays < 7);
  assert.ok(tr.tli > 2 && tr.tli < 4);
});
test("Manual hold input is UTC and invalid lines fail closed", () => {
  const holds = parseHolds("2026-11-20T00:00Z,2026-11-20T01:00Z");
  assert.equal(holds.errors.length,0);
  assert.equal(holds.intervals.length,1);
  assert.equal(holds.intervals[0].b-holds.intervals[0].a,3600000);
  assert.equal(parseHolds("not valid").errors.length,1);
  assert.equal(parseHolds("").intervals.length,0);
});
test("Departure scan returns ordered candidates and labels overlapping holds", () => {
  const empty = searchWindows(KSC,TARGET,200,12,60,[]);
  assert.equal(empty.length,25);
  assert.ok(empty.every(c => Number.isFinite(c.penalty) && !c.held));
  for (let i=1;i<empty.length;i++) assert.ok(empty[i].penalty>=empty[i-1].penalty);
  const first=empty[0].launch;
  const blocked=searchWindows(KSC,TARGET,200,12,60,[{a:first,b:first+60000}]);
  assert.equal(blocked.find(c=>c.launch===first).held,true);
});
