import type { Placement } from "../specification/types.js";

export function resolvePlacementTarget(placement: Placement): Element | null {
  if (placement.selector) return document.querySelector(placement.selector);
  return document.querySelector(`[data-ad-runner-slot="${cssEscape(placement.anchor)}"]`);
}
export function insertContainer(target: Element, placement: Placement): HTMLElement {
  const container = document.createElement("div");
  container.dataset.adRunnerPlacement = placement.id;
  target.setAttribute("data-ad-runner-active", "true");
  switch (placement.insertion ?? "append") {
    case "inside":
    case "append": target.appendChild(container); break;
    case "prepend": target.prepend(container); break;
    case "before": target.before(container); break;
    case "after": target.after(container); break;
    case "replace": target.replaceWith(container); break;
  }
  return container;
}
function cssEscape(value: string): string { return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
