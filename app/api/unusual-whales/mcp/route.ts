import { NextResponse } from "next/server";

import { canAccessMcp } from "@/lib/unusual-whales/access";
import { handleMcpJsonRpc, MCP_TOOLS, mcpServerInfo } from "@/lib/unusual-whales/mcp";

export async function GET(request: Request) {
  if (!(await canAccessMcp(request))) {
    return NextResponse.json(
      { error: "Unauthorized. Use a PeakPlus session, personal desk cookie, or Bearer UW_MCP_TOKEN." },
      { status: 401 },
    );
  }
  return NextResponse.json({
    ...mcpServerInfo(),
    tools: MCP_TOOLS,
  });
}

export async function POST(request: Request) {
  if (!(await canAccessMcp(request))) {
    return NextResponse.json(
      { error: "Unauthorized. Use a PeakPlus session, personal desk cookie, or Bearer UW_MCP_TOKEN." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } },
      { status: 400 },
    );
  }

  const result = await handleMcpJsonRpc(body);
  return NextResponse.json(result);
}
