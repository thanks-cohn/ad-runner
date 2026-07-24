export type AdRunnerEventName = "view" | "load" | "error" | "click" | "revenue";
export interface AdRunnerEvent { name: AdRunnerEventName; placement?: string; unit?: string; value?: number; }
export function receiveEvent(event: AdRunnerEvent): void { void event; }
