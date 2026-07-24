import type { Placement } from "../specification/types.js";
export function resolvePlacementTarget(placement: Placement): Element | null { const nodes=placement.selector?[...document.querySelectorAll(placement.selector)]:[...document.querySelectorAll(`[data-ad-runner-slot="${cssEscape(placement.anchor)}"]`)]; return nodes[0]??null; }
function cssEscape(value:string){return typeof CSS!=="undefined"&&CSS.escape?CSS.escape(value):value.replace(/[^a-zA-Z0-9_-]/g,"\\$&");}
