import { canAccessPersonalDesk } from "@/lib/unusual-whales/access";
import { fetchDashboardSnapshot } from "@/lib/unusual-whales/client";
import { getPersonalAccessToken } from "@/lib/unusual-whales/config";

import { WhalesDesk } from "./WhalesDesk";
import { WhalesUnlockForm } from "./WhalesUnlockForm";

export default async function WhalesPage() {
  const allowed = await canAccessPersonalDesk();
  const tokenConfigured = Boolean(getPersonalAccessToken());

  if (!allowed) {
    return <WhalesUnlockForm tokenConfigured={tokenConfigured} />;
  }

  return <WhalesDesk initial={await fetchDashboardSnapshot()} />;
}
