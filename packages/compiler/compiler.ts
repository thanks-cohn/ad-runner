import type { AdRunnerManifest, DeviceTarget, OptimizationMode, Placement } from "../specification/types.js";
import type { ParsedBlocks, SpreadsheetRow } from "./parser.js";
import { parseRows } from "./parser.js";
import { validateManifest } from "./validator.js";

const bool = (value: string | undefined, fallback = true): boolean => value === undefined ? fallback : ["true", "1", "yes", "on"].includes(value.toLowerCase());
const list = (value: string | undefined, fallback: string[]): string[] => value ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;

export function compileRows(rows: SpreadsheetRow[], mode: OptimizationMode = "maximum-profit", version = "dev"): AdRunnerManifest {
  return compileBlocks(parseRows(rows, mode), mode, version);
}

export function compileBlocks(blocks: ParsedBlocks, mode: OptimizationMode, version: string): AdRunnerManifest {
  const site = blocks.SITE?.site ?? {};
  const manifest: AdRunnerManifest = {
    spec: "ad-runner/1",
    site: site.site_id,
    version,
    mode: (site.default_mode as OptimizationMode) || mode,
    settings: {
      enabled: bool(site.enabled, true),
      lazy_load: bool(site.lazy_load, true),
      collapse_empty_slots: bool(site.collapse_empty_slots, true),
      debug: bool(site.debug, false)
    },
    networks: {},
    units: {},
    placements: []
  };
  for (const [id, network] of Object.entries(blocks.NETWORK ?? {})) {
    manifest.networks[id] = { adapter: network.adapter ?? id, enabled: bool(network.enabled, true), loader: { src: network.loader_src, async: bool(network.loader_async, true), load_once: bool(network.load_once, true) } };
  }
  for (const [id, unit] of Object.entries(blocks.UNIT ?? {})) {
    manifest.units[id] = { network: unit.network, format: unit.format, markup: unit.markup, execute: unit.execute, style: unit.style };
  }
  for (const [id, placement] of Object.entries(blocks.PLACEMENT ?? {})) {
    const compiled: Placement = { id, anchor: placement.anchor, selector: placement.selector, insertion: placement.insertion as Placement["insertion"] | undefined, devices: list(placement.devices, ["all"]) as DeviceTarget[], priority: Number(placement.priority ?? 0), enabled: bool(placement.enabled, true) };
    const units = list(placement.units, []);
    if (units.length) compiled.units = units;
    else compiled.unit = placement.unit;
    manifest.placements.push(compiled);
  }
  validateManifest(manifest);
  return manifest;
}
