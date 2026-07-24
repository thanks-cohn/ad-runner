export type OptimizationMode = "aesthetic" | "maximum-visibility" | "maximum-clicks" | "maximum-revenue";
export const VALID_MODES: OptimizationMode[] = ["aesthetic","maximum-visibility","maximum-clicks","maximum-revenue"];
export type DeviceTarget = "all" | "desktop" | "mobile";
export type Insertion = "inside" | "before" | "after" | "prepend" | "append" | "replace";
export type CandidateOutcome = "filled" | "no-fill" | "timeout" | "error" | "unknown";
export interface LoaderConfiguration { src?: string; async?: boolean; load_once?: boolean; html?: string; success_message?: string; failure_message?: string; timeout_ms?: number; }
export interface NetworkConfiguration { adapter: string; enabled: boolean; loader?: LoaderConfiguration; allowed_origins?: string[]; }
export interface AdUnit { network: string; format?: string; markup?: string; execute?: string; style?: string; image_url?: string; destination_url?: string; alt_text?: string; html?: string; text?: string; width?: number; height?: number; target_blank?: boolean; simulated_outcome?: CandidateOutcome; simulated_delay_ms?: number; external_success_message?: string; external_failure_message?: string; secret_ref?: string; [key: string]: unknown; }
export interface PlacementCandidate { unit: string; priority: number; timeout_ms: number; guaranteed?: boolean; }
export interface CandidateResult { outcome: CandidateOutcome; reason?: string; renderedAt?: number; }
export interface Placement { id: string; anchor: string; selector?: string; insertion?: Insertion; devices: DeviceTarget[]; priority: number; enabled: boolean; candidates: PlacementCandidate[]; unit?: string; units?: string[]; }
export interface ManifestSettings { enabled: boolean; lazy_load: boolean; collapse_empty_slots: boolean; debug: boolean; allow_unsafe_scripts?: boolean; observe_dom?: boolean; cors_origins?: string[]; }
export interface AdRunnerManifest { spec: "ad-runner/1"; site: string; version: string; mode: OptimizationMode; settings: ManifestSettings; networks: Record<string, NetworkConfiguration>; units: Record<string, AdUnit>; placements: Placement[]; warnings?: string[]; candidateOrder?: Record<string,string[]>; }
export interface BootstrapConfiguration { spec: "ad-runner/1"; site: string; version: string; manifest: string; publishedAt?: string; }
