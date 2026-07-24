import { BOOTSTRAP_CACHE_CONTROL, MANIFEST_CACHE_CONTROL } from "../packages/runtime/cache.js";
import type { AdRunnerManifest } from "../packages/specification/types.js";
import { createBootstrap } from "../packages/compiler/publisher.js";

export class AdRunnerApi {
  private manifests = new Map<string, AdRunnerManifest>();
  publish(manifest: AdRunnerManifest): void { this.manifests.set(manifest.site, manifest); }
  bootstrap(site: string): Response { const manifest = this.requireManifest(site); return Response.json(createBootstrap(manifest), { headers: { "Cache-Control": BOOTSTRAP_CACHE_CONTROL, ETag: `"${site}-${manifest.version}"` } }); }
  versionedManifest(site: string, version: string): Response { const manifest = this.requireManifest(site); if (manifest.version !== version) return new Response("Not found", { status: 404 }); return Response.json(manifest, { headers: { "Cache-Control": MANIFEST_CACHE_CONTROL } }); }
  health(site: string): Response { const manifest = this.requireManifest(site); return Response.json({ site, status: "healthy", live_version: manifest.version, compiled_at: new Date().toISOString() }); }
  events(): Response { return new Response(null, { status: 204 }); }
  private requireManifest(site: string): AdRunnerManifest { const manifest = this.manifests.get(site); if (!manifest) throw new Error(`Unknown Ad Runner site: ${site}`); return manifest; }
}
