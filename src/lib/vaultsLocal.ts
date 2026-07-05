import type { RecentVault } from "@/stores/settingsStore";

const LOCAL_KEY = "rainstone_recent_vaults";

export function loadRecentVaults(): RecentVault[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentVault[];
  } catch {
    return [];
  }
}

export function saveRecentVaults(vaults: RecentVault[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(vaults));
}

/** Add a vault to the front of the recent list, deduplicating by path. */
export function addRecentVault(vault: RecentVault): RecentVault[] {
  const current = loadRecentVaults();
  const filtered = current.filter((v) => v.path !== vault.path);
  const updated = [vault, ...filtered].slice(0, 20); // keep at most 20
  saveRecentVaults(updated);
  return updated;
}

/** Remove a vault from the recent list by path. */
export function removeRecentVaultLocal(path: string): RecentVault[] {
  const current = loadRecentVaults();
  const updated = current.filter((v) => v.path !== path);
  saveRecentVaults(updated);
  return updated;
}
