export type ToolId = "claude" | "codex" | "opencode" | "devin" | "anthropic-api" | "openai-api" | "xai-api";
export interface ToolInfo { id: ToolId; label: string; color: string; kind: "local" | "api"; side: "claude" | "codex" | null }
export declare const TOOLS: readonly ToolInfo[];
export declare const TOOL_IDS: readonly ToolId[];
export declare function isTool(x: unknown): x is ToolId;
export declare function toolById(id: string): ToolInfo | undefined;
