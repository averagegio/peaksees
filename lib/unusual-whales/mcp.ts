import "server-only";

import { unusualWhalesTools } from "./client";
import { isUnusualWhalesDemoMode } from "./config";

export type McpToolName = keyof typeof unusualWhalesTools;

export const MCP_TOOLS: Array<{
  name: McpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  {
    name: "flow_alerts",
    description: "Unusual options flow alerts from Unusual Whales (volume/OI, premium, OTM filters).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
      },
    },
  },
  {
    name: "darkpool_recent",
    description: "Recent market-wide dark pool prints.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
      },
    },
  },
  {
    name: "congress_recent_trades",
    description: "Recently disclosed congressional stock trades.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
      },
    },
  },
  {
    name: "market_tide",
    description: "Market Tide net call vs put premium series.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "option_screener",
    description: "Hottest option contracts screener.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
      },
    },
  },
  {
    name: "news_headlines",
    description: "Latest Unusual Whales news headlines.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "dashboard_snapshot",
    description: "Combined Peaksees Unusual Whales dashboard snapshot (flow, dark pool, congress, tide, screener, news).",
    inputSchema: { type: "object", properties: {} },
  },
];

function limitFromArgs(args: Record<string, unknown> | undefined, fallback: number): number {
  const raw = args?.limit;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

export async function callMcpTool(
  name: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "flow_alerts":
      return unusualWhalesTools.flow_alerts(limitFromArgs(args, 40));
    case "darkpool_recent":
      return unusualWhalesTools.darkpool_recent(limitFromArgs(args, 30));
    case "congress_recent_trades":
      return unusualWhalesTools.congress_recent_trades(limitFromArgs(args, 25));
    case "market_tide":
      return unusualWhalesTools.market_tide();
    case "option_screener":
      return unusualWhalesTools.option_screener(limitFromArgs(args, 25));
    case "news_headlines":
      return unusualWhalesTools.news_headlines(limitFromArgs(args, 15));
    case "dashboard_snapshot":
      return unusualWhalesTools.dashboard_snapshot();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function mcpServerInfo() {
  return {
    name: "peaksees-unusual-whales",
    version: "1.0.0",
    title: "Peaksees Unusual Whales",
    demo: isUnusualWhalesDemoMode(),
    officialMcp: "https://api.unusualwhales.com/api/mcp",
  };
}

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export async function handleMcpJsonRpc(body: JsonRpcRequest): Promise<Record<string, unknown>> {
  const id = body.id ?? null;
  const method = typeof body.method === "string" ? body.method : "";

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: mcpServerInfo(),
      },
    };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list" || method === "list_tools") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: MCP_TOOLS },
    };
  }

  if (method === "tools/call" || method === "call_tool") {
    const params = body.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : undefined;
    try {
      const data = await callMcpTool(name, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
          isError: false,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool failed";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: message }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}
