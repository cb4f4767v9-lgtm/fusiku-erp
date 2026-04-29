/**
 * Client-only billing / subscription placeholders until a real billing API exists.
 * Keys are cleared on logout to avoid leaking tenant context across sessions.
 */
const TRIAL_KEY = 'fusiku_ui_trial_active';
const COMPANY_KEY = 'fusiku_ui_company_name';
const TRIAL_END_KEY = 'fusiku_ui_trial_ends_at';

/** Default trial length for UI countdown (server will own this later). */
export const DEFAULT_TRIAL_DAYS = 14;

export type BillingPlanId = 'free' | 'pro';

function trialFlagOn(): boolean {
  try {
    return localStorage.getItem(TRIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPostSignupBillingUi(companyName: string) {
  try {
    const end = new Date();
    end.setDate(end.getDate() + DEFAULT_TRIAL_DAYS);
    localStorage.setItem(TRIAL_KEY, '1');
    localStorage.setItem(COMPANY_KEY, companyName.trim());
    localStorage.setItem(TRIAL_END_KEY, end.toISOString());
  } catch {
    /* quota / private mode */
  }
}

/** Calendar days until trial end (ceil). `null` if no active trial window. */
export function getTrialCalendarDaysRemaining(): number | null {
  try {
    if (!trialFlagOn()) return null;
    let endIso = localStorage.getItem(TRIAL_END_KEY);
    if (!endIso) {
      const end = new Date();
      end.setDate(end.getDate() + DEFAULT_TRIAL_DAYS);
      endIso = end.toISOString();
      localStorage.setItem(TRIAL_END_KEY, endIso);
    }
    const endMs = new Date(endIso).getTime();
    if (Number.isNaN(endMs)) return null;
    return Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

export function isTrialActive(): boolean {
  const days = getTrialCalendarDaysRemaining();
  return days !== null && days >= 0;
}

export type TrialUiState = 'none' | 'active' | 'expired';

export function getTrialUiState(): TrialUiState {
  const days = getTrialCalendarDaysRemaining();
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  return 'active';
}

export function getBillingCompanyName(): string | null {
  try {
    const v = localStorage.getItem(COMPANY_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Placeholder until subscription state is server-driven */
export function getCurrentBillingPlanId(): BillingPlanId {
  return 'free';
}

export function clearBillingUiStorage() {
  try {
    localStorage.removeItem(TRIAL_KEY);
    localStorage.removeItem(COMPANY_KEY);
    localStorage.removeItem(TRIAL_END_KEY);
  } catch {
    /* */
  }
}
