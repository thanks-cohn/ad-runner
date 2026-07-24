import type { AdNetworkAdapter } from "./registry.js";

const truthy = (value: unknown): boolean =>
  value === true || ["true", "1", "yes", "on"].includes(String(value ?? "").toLowerCase());

const boundedDelay = (value: unknown, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 10_000)) : fallback;
};

function asDocument(markup: string): string {
  if (/<html[\s>]/i.test(markup)) return markup;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${markup}</body></html>`;
}

export const externalTagAdapter: AdNetworkAdapter = {
  id: "external-tag",

  async mount(unit, container, ctx, signal) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.width = String(unit.width ?? "100%");
    iframe.height = String(unit.height ?? 90);

    const success = String(
      unit.external_success_message ?? ctx.manifest.networks[unit.network]?.loader?.success_message ?? "",
    );
    const fail = String(
      unit.external_failure_message ?? ctx.manifest.networks[unit.network]?.loader?.failure_message ?? "",
    );
    const assumeFilled = truthy(unit.assume_filled_on_mount);
    const graceMs = boundedDelay(unit.mount_grace_ms, 750);
    const markup = String(unit.markup ?? unit.html ?? "");

    container.appendChild(iframe);

    if (!success && !fail && !assumeFilled) {
      iframe.srcdoc = asDocument(markup);
      return {
        outcome: "unknown",
        reason: "external tag has no reliable fill signal",
        renderedAt: Date.now(),
      };
    }

    return await new Promise((resolve, reject) => {
      let graceTimer: number | undefined;

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        iframe.removeEventListener("load", onLoad);
        signal.removeEventListener("abort", onAbort);
        if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      };

      const finish = (result: Parameters<typeof resolve>[0]) => {
        cleanup();
        resolve(result);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return;
        if (success && event.data === success) {
          finish({ outcome: "filled", renderedAt: Date.now() });
        } else if (fail && event.data === fail) {
          finish({ outcome: "no-fill", reason: "external failure message" });
        }
      };

      const onLoad = () => {
        if (!assumeFilled) return;
        graceTimer = window.setTimeout(
          () => finish({ outcome: "filled", reason: "external tag mounted", renderedAt: Date.now() }),
          graceMs,
        );
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException("aborted", "AbortError"));
      };

      window.addEventListener("message", onMessage);
      iframe.addEventListener("load", onLoad, { once: true });
      signal.addEventListener("abort", onAbort, { once: true });
      iframe.srcdoc = asDocument(markup);
    });
  },

  async destroy(_unit, container) {
    container.remove();
  },
};
