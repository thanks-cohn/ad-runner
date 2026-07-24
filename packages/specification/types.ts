export type OptimizationMode = "aesthetic" | "maximum-conversion" | "maximum-clicks" | "maximum-profit";
export type DeviceTarget = "all" | "desktop" | "mobile";
export type Insertion = "inside" | "before" | "after" | "prepend" | "append" | "replace";

export interface LoaderConfiguration { src?: string; async?: boolean; load_once?: boolean; }
export interface NetworkConfiguration { adapter: string; enabled: boolean; loader?: LoaderConfiguration; }
export interface AdUnit { network: string; format?: string; markup?: string; execute?: string; style?: string; }
export interface Placement { id: string; anchor: string; selector?: string; insertion?: Insertion; unit?: string; units?: string[]; devices: DeviceTarget[]; priority: number; enabled: boolean; }
export interface ManifestSettings { enabled: boolean; lazy_load: boolean; collapse_empty_slots: boolean; debug: boolean; }
export interface AdRunnerManifest { spec: "ad-runner/1"; site: string; version: string; mode: OptimizationMode; settings: ManifestSettings; networks: Record<string, NetworkConfiguration>; units: Record<string, AdUnit>; placements: Placement[]; }
export interface BootstrapConfiguration { spec: "ad-runner/1"; site: string; version: string; manifest: string; }
