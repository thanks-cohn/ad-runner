import type { AdRunnerManifest, BootstrapConfiguration } from "../specification/types.js";

export function versionManifest(manifest: Omit<AdRunnerManifest, "version">): AdRunnerManifest {
  const hash = stableHash(JSON.stringify(manifest));
  return { ...manifest, version: hash };
}
export function createBootstrap(manifest: AdRunnerManifest): BootstrapConfiguration {
  return { spec: "ad-runner/1", site: manifest.site, version: manifest.version, manifest: `/v1/sites/${encodeURIComponent(manifest.site)}/manifests/${encodeURIComponent(manifest.version)}.json` };
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
