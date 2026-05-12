# Fusiku ERP — Language & Localization Audit
**Generated:** 2026-05-11

---

## Current System

| Feature | Implementation |
|---------|---------------|
| Framework | i18next + react-i18next |
| Languages | English (en), Arabic (ar), Chinese Simplified (zh), Urdu (ur) |
| Fallback | English |
| Persistence | localStorage (`fusiku_lang`) + synced to backend user preferences |
| RTL | Auto-set via `document.dir = 'rtl'` for ar/ur |
| Font stacks | Inter (Latin), Noto Sans Arabic (ar/ur), Noto Sans SC (zh) |

## Translation Coverage

| Language | File size (lines) | Key coverage | Gaps |
|----------|-------------------|-------------|------|
| English | ~1499 | 100% (reference) | — |
| Arabic | ~1140 | ~85% | institute, parts catalog, sourcing, quotations, some POS |
| Chinese | ~1140 | ~85% | Same gaps as Arabic |
| Urdu | ~1140 | ~85% | Same gaps as Arabic |

## Formatting Infrastructure

| Feature | Status | Implementation |
|---------|--------|---------------|
| Number formatting | Yes | `Intl.NumberFormat` via `formatting.ts` |
| Currency formatting | Yes | `formatCurrency()` with locale-aware Intl |
| Date formatting | Yes | `Intl.DateTimeFormat` via `formatting.ts` |
| Calendar systems | No | Gregorian only |
| RTL layout | Yes | CSS logical properties throughout |
| Font compatibility | Yes | Per-language font stacks in global.css |
| Server-side messages | Yes | `apiMessages.ts` with 4-language error messages |
| Admin translation UI | Yes | TranslationsAdminPage with auto-fill, import, verification |

## RTL Implementation Quality

| Component | RTL Status |
|-----------|-----------|
| Sidebar | LTR-locked (`direction: ltr`) even in RTL — intentional design choice |
| Tables | Proper `text-align: start/end` |
| Dropdowns | `inset-inline-start/end` positioning |
| Login layout | RTL-aware with `html[dir="rtl"]` overrides |
| Modals | Standard centered — works in both directions |
| Forms | Labels flow correctly with logical properties |

## Gaps & Recommendations

1. **15% translation gap** across ar/zh/ur — all missing the same sections (recently added institute module)
2. **No Hijri/Lunar calendar** — important for Arabic/Urdu markets
3. **No locale-specific number input** — Arabic numerals not supported in inputs
4. **Brand switching** — BrandingContext exists but no per-language branding
5. **AI-assisted translation** — TranslationsAdminPage has auto-fill endpoint wired
6. **No pluralization rules** — i18next supports them but no `_plural` keys found
