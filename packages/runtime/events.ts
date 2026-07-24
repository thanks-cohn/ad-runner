export function dispatchAdRunnerEvent(name: string, detail: unknown): void {
  window.dispatchEvent(new CustomEvent(`adrunner:${name}`, { detail }));
}
