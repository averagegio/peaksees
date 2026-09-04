import { getPersonalDeskEntry } from "@/lib/unusual-whales/access";
import { fetchDashboardSnapshot } from "@/lib/unusual-whales/client";
import { getPersonalAccessToken } from "@/lib/unusual-whales/config";

import { WhalesDesk } from "./WhalesDesk";
import { WhalesUnlockForm } from "./WhalesUnlockForm";

export const dynamic = "force-dynamic";

export default async function WhalesPage() {
  const entry = await getPersonalDeskEntry();
  const tokenConfigured = Boolean(getPersonalAccessToken());

  if (!entry.ok) {
    return <WhalesUnlockForm tokenConfigured={tokenConfigured} />;
  }

  return (
    <WhalesDesk
      initial={await fetchDashboardSnapshot()}
      lockable={entry.via === "cookie"}
    />
  );
}
