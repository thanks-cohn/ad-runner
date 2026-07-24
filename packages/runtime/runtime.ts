import type { AdRunnerManifest, BootstrapConfiguration, NetworkConfiguration, Placement } from "../specification/types.js";
import { dispatchAdRunnerEvent } from "./events.js";
import { insertContainer, resolvePlacementTarget } from "./placement.js";

export class AdRunnerRuntime {
  manifest: AdRunnerManifest | null = null;
  private loadedNetworks = new Map<string, Promise<void>>();
  private disabled = false;
  constructor(public siteId: string, private baseUrl = "") {}
  async start(): Promise<void> {
    this.disabled = false;
    const bootstrap = await this.fetchJSON<BootstrapConfiguration>(`${this.baseUrl}/v1/sites/${encodeURIComponent(this.siteId)}/bootstrap.json`);
    this.manifest = await this.fetchJSON<AdRunnerManifest>(bootstrap.manifest);
    if (!this.manifest.settings.enabled || this.disabled) return;
    await this.mountPlacements();
    this.dispatch("ready", { site: this.siteId, version: this.manifest.version });
  }
  stop(): void { this.disabled = true; }
  disable(): void { this.stop(); }
  getStatus(): object { return { site: this.siteId, disabled: this.disabled, version: this.manifest?.version ?? null }; }
  async refresh(placementId: string): Promise<void> { await this.mount(placementId); }
  async mount(anchorOrPlacementId: string): Promise<void> {
    const placement = this.manifest?.placements.find((item) => item.id === anchorOrPlacementId || item.anchor === anchorOrPlacementId);
    if (placement) await this.mountOne(placement);
  }
  private async mountPlacements(): Promise<void> {
    const placements = [...(this.manifest?.placements ?? [])].filter((p) => p.enabled).sort((a, b) => b.priority - a.priority);
    for (const placement of placements) if (this.deviceMatches(placement.devices)) await this.mountOne(placement);
  }
  private async mountOne(placement: Placement): Promise<void> {
    const target = resolvePlacementTarget(placement);
    if (!target || !this.manifest) return this.dispatch("missing-slot", { placement: placement.id, anchor: placement.anchor });
    for (const unitId of placement.units ?? (placement.unit ? [placement.unit] : [])) {
      const unit = this.manifest.units[unitId];
      const network = unit && this.manifest.networks[unit.network];
      if (!unit || !network?.enabled) continue;
      try {
        const container = insertContainer(target, placement);
        container.innerHTML = unit.markup ?? "";
        await this.loadNetwork(unit.network, network);
        if (unit.execute) this.executeUnitCode(unit.execute, container);
        this.dispatch("slot-mounted", { placement: placement.id, unit: unitId });
        return;
      } catch (error) { this.dispatch("slot-failed", { placement: placement.id, unit: unitId, error: String(error) }); }
    }
    if (this.manifest.settings.collapse_empty_slots) target.removeAttribute("data-ad-runner-active");
  }
  private async loadNetwork(networkId: string, network: NetworkConfiguration): Promise<void> {
    if (network.loader?.load_once !== false && this.loadedNetworks.has(networkId)) return this.loadedNetworks.get(networkId);
    const promise = new Promise<void>((resolve, reject) => {
      if (!network.loader?.src) return resolve();
      const script = document.createElement("script");
      script.src = network.loader.src;
      script.async = network.loader.async !== false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Unable to load ${network.loader?.src}`));
      document.head.appendChild(script);
    });
    if (network.loader?.load_once !== false) this.loadedNetworks.set(networkId, promise);
    await promise;
    this.dispatch("network-loaded", { network: networkId });
  }
  private executeUnitCode(code: string, container: HTMLElement): void { new Function("container", "manifest", `"use strict";\n${code}`)(container, this.manifest); }
  private deviceMatches(devices = ["all"]): boolean { if (devices.includes("all")) return true; const mobile = window.matchMedia("(max-width: 767px)").matches; return mobile ? devices.includes("mobile") : devices.includes("desktop"); }
  private async fetchJSON<T>(url: string): Promise<T> { const response = await fetch(url); if (!response.ok) throw new Error(`Ad Runner request failed: ${response.status}`); return response.json() as Promise<T>; }
  private dispatch(name: string, detail: unknown): void { dispatchAdRunnerEvent(name, detail); }
}

declare global { interface Window { AdRunner?: AdRunnerRuntime; } }
const script = document.currentScript as HTMLScriptElement | null;
const siteId = script?.dataset.adRunnerSite;
if (siteId) { window.AdRunner = new AdRunnerRuntime(siteId); window.AdRunner.start().catch((error) => dispatchAdRunnerEvent("manifest-error", { error: String(error) })); }
