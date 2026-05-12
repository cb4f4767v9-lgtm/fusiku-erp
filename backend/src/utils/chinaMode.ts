/** When `CHINA_MODE=1`, skip external email/SMS providers and use console-only OTP (see otp delivery services). */
export function isChinaMode(): boolean {
  return String(process.env.CHINA_MODE || '').trim() === '1';
}
