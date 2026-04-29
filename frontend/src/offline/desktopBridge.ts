export function isElectronLocalDbAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { electronLocalDb?: unknown }).electronLocalDb);
}
