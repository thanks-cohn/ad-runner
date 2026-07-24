import type { AdNetworkAdapter } from "./raw-script.js";
export const directSponsorAdapter: AdNetworkAdapter = { id: "direct-sponsor", async load() {}, async mount(unit, container) { container.innerHTML = unit.markup ?? ""; } };
