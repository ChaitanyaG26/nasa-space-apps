import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyReferenceDataset,geometryAtUtc} from "../web/horizons-static.mjs";
test("Reference ephemeris geometry is finite at direct-check epoch and sites",()=>{
 const data=verifyReferenceDataset(JSON.parse(readFileSync(new URL("../web/assets/horizons-moon-reference.json",import.meta.url),"utf8")));
 for(const [lat,lon] of [[-89.5,0],[-85,90],[-53.033,-99.811]]){
  const g=geometryAtUtc(data,lat,lon,"2026-12-12T12:00:00Z");
  assert.ok(Number.isFinite(g.sun_az)&&Number.isFinite(g.sun_el)&&Number.isFinite(g.earth_az)&&Number.isFinite(g.earth_el));
 }
});
