import assert from "node:assert/strict";
import test from "node:test";
import { compileRows } from "../dist/packages/compiler/compiler.js";

test("compiles spreadsheet rows into a validated manifest", () => {
  const manifest = compileRows([
    { block_type: "SITE", block_id: "site", field: "site_id", value: "animeplex.lol", aesthetic: "on", conversion: "on", clicks: "on", profit: "on" },
    { block_type: "NETWORK", block_id: "exoclick", field: "adapter", value: "exoclick", aesthetic: "on", conversion: "on", clicks: "on", profit: "on" },
    { block_type: "UNIT", block_id: "exo_top", field: "network", value: "exoclick", aesthetic: "on", conversion: "on", clicks: "on", profit: "on" },
    { block_type: "PLACEMENT", block_id: "main_top", field: "anchor", value: "top", aesthetic: "on", conversion: "on", clicks: "on", profit: "on" },
    { block_type: "PLACEMENT", block_id: "main_top", field: "unit", value: "exo_top", aesthetic: "on", conversion: "on", clicks: "on", profit: "on" }
  ], "maximum-profit", "42");

  assert.equal(manifest.site, "animeplex.lol");
  assert.equal(manifest.placements[0]?.anchor, "top");
});
