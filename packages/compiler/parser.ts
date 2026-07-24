import type { OptimizationMode } from "../specification/types.js";

export interface SpreadsheetRow { block_type: string; block_id: string; field: string; value: string; aesthetic?: string; conversion?: string; clicks?: string; profit?: string; notes?: string; }
export type ParsedBlocks = Record<string, Record<string, Record<string, string>>>;
const modeColumn: Record<OptimizationMode, keyof SpreadsheetRow> = { aesthetic: "aesthetic", "maximum-conversion": "conversion", "maximum-clicks": "clicks", "maximum-profit": "profit" };
export function parseRows(rows: SpreadsheetRow[], mode: OptimizationMode): ParsedBlocks {
  const blocks: ParsedBlocks = {};
  for (const row of rows) {
    if (!row.block_type || !row.block_id || !row.field) continue;
    const modeValue = row[modeColumn[mode]] ?? "on";
    if (["off", "false", "0", "no"].includes(modeValue.toLowerCase())) continue;
    const type = row.block_type.toUpperCase();
    blocks[type] ??= {};
    blocks[type][row.block_id] ??= {};
    blocks[type][row.block_id][row.field] = row.value;
  }
  return blocks;
}
