import InfoPage from "@/app/components/marketing/InfoPage";

export default function DevelopersPage() {
  return (
    <InfoPage
      title="Developers"
      body="Peaksees hosts an Unusual Whales MCP endpoint at /api/unusual-whales/mcp (JSON-RPC tools/list and tools/call) for PeakPlus sessions, the owner personal desk, or Bearer UW_MCP_TOKEN. Dashboards at /peakflow and /whales call the same server-side client — the API key never ships to the browser. The official Unusual Whales MCP remains at https://api.unusualwhales.com/api/mcp."
    />
  );
}
