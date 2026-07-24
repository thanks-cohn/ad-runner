import type { AdUnit, NetworkConfiguration } from "../specification/types.js";

export interface RuntimeContext { manifest: unknown; }
export interface AdNetworkAdapter { id: string; load(network: NetworkConfiguration, context: RuntimeContext): Promise<void>; mount(unit: AdUnit, container: HTMLElement, context: RuntimeContext): Promise<void>; refresh?(unit: AdUnit, container: HTMLElement, context: RuntimeContext): Promise<void>; destroy?(unit: AdUnit, container: HTMLElement, context: RuntimeContext): Promise<void>; }

export const rawScriptAdapter: AdNetworkAdapter = {
  id: "raw-script",
  async load() {},
  async mount(unit, container, context) {
    container.innerHTML = unit.markup ?? "";
    if (unit.execute) new Function("container", "manifest", `"use strict";\n${unit.execute}`)(container, context.manifest);
  }
};
