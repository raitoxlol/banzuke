// Convex validator for tool ids, generated from the registry (lib/tools.mjs) so it can't drift.
import { v, type Validator } from "convex/values";
import { TOOL_IDS, type ToolId } from "../lib/tools.mjs";

const lits = TOOL_IDS.map((t) => v.literal(t)) as unknown as [Validator<ToolId>, Validator<ToolId>, ...Validator<ToolId>[]];
export const toolValidator = v.union(...lits);
