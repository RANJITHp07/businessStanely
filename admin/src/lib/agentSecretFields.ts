/** Agent columns that must never be sent to a browser. For Prisma's `omit`. */
export const AGENT_SECRET_FIELDS = {
  password: true,
  resetOtp: true,
  otpExpiry: true,
  isOtpVerified: true,
  currentSessionToken: true,
} as const;
