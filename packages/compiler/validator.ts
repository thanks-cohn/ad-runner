import type { AdRunnerManifest } from "../specification/types.js";

export function validateManifest(manifest: AdRunnerManifest): void {
  const errors: string[] = [];
  if (manifest.spec !== "ad-runner/1") errors.push("spec must be ad-runner/1");
  if (!manifest.site) errors.push("site is required");
  for (const [id, unit] of Object.entries(manifest.units)) {
    if (!unit.network || !manifest.networks[unit.network]) errors.push(`unit ${id} references missing network ${unit.network}`);
  }
  for (const placement of manifest.placements) {
    if (!placement.id || !placement.anchor) errors.push(`placement ${placement.id || "<unknown>"} requires id and anchor`);
    const candidates = placement.units ?? (placement.unit ? [placement.unit] : []);
    if (!candidates.length) errors.push(`placement ${placement.id} requires unit or units`);
    for (const unitId of candidates) if (!manifest.units[unitId]) errors.push(`placement ${placement.id} references missing unit ${unitId}`);
  }
  if (errors.length) throw new Error(`Invalid Ad Runner manifest:\n${errors.join("\n")}`);
}
