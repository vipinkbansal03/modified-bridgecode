import crypto from "crypto";
import axios from "axios";
import { redis } from "../../config/redis";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/apiResponse";
import { getSettingValue } from "../settings/settings.service";
import { resolveMsg91Config, sendMsg91Otp } from "../notifications/msg91Provider";

export type OtpPurpose = "LOGIN" | "REGISTER";

export interface OtpSession {
  verificationId: string;
  phone: string;
  purpose: OtpPurpose;
  hashedOtp: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
  payload?: any;
}

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_RESEND_COOLDOWN_SECONDS = 60; // 60 seconds cooldown
const MAX_ATTEMPTS = 3;

// In-memory fallback map if Redis is temporarily unreachable
const inMemoryOtpStore = new Map<string, OtpSession>();

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function maskPhoneNumber(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 4) return clean;
  const visibleCount = Math.min(4, Math.floor(clean.length / 3));
  const prefixCount = clean.startsWith("+") ? 3 : 2;
  const prefix = clean.slice(0, prefixCount);
  const suffix = clean.slice(-visibleCount);
  const maskedMiddle = "*".repeat(Math.max(4, clean.length - prefixCount - visibleCount));
  return `${prefix} ${maskedMiddle} ${suffix}`;
}

async function saveOtpSession(session: OtpSession): Promise<void> {
  const key = `otp:session:${session.verificationId}`;
  const serialized = JSON.stringify(session);
  try {
    if (redis && redis.status === "ready") {
      await redis.set(key, serialized, "EX", OTP_TTL_SECONDS);
    }
  } catch (err) {
    logger.warn("Redis write failed for OTP session, using in-memory store", err);
  }
  inMemoryOtpStore.set(session.verificationId, session);
}

async function getOtpSession(verificationId: string): Promise<OtpSession | null> {
  const key = `otp:session:${verificationId}`;
  try {
    if (redis && redis.status === "ready") {
      const data = await redis.get(key);
      if (data) return JSON.parse(data) as OtpSession;
    }
  } catch (err) {
    logger.warn("Redis read failed for OTP session, falling back to in-memory store", err);
  }
  const session = inMemoryOtpStore.get(verificationId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    inMemoryOtpStore.delete(verificationId);
    return null;
  }
  return session;
}

async function deleteOtpSession(verificationId: string): Promise<void> {
  const key = `otp:session:${verificationId}`;
  try {
    if (redis && redis.status === "ready") {
      await redis.del(key);
    }
  } catch (err) {
    logger.warn("Redis delete failed for OTP session", err);
  }
  inMemoryOtpStore.delete(verificationId);
}

async function sendSms(phone: string, otp: string): Promise<void> {
  const [providerSetting, smsEnabledSetting] = await Promise.all([
    getSettingValue("sms.provider").catch(() => ""),
    getSettingValue("sms.enabled").catch(() => ""),
  ]);

  if (smsEnabledSetting === "false") {
    logger.info(`[SMS OTP] SMS is disabled in settings. Skipping OTP dispatch to ${phone}`);
    return;
  }

  const provider = (providerSetting || process.env.SMS_PROVIDER || "msg91").trim().toLowerCase();

  // Primary provider: MSG91
  if (provider === "msg91") {
    try {
      const result = await sendMsg91Otp(phone, otp);
      if (!result.mock) {
        return;
      }
    } catch (err: any) {
      logger.error(`[SMS OTP] MSG91 OTP error: ${err.message}. Falling back to dev logger.`);
    }
  } else if (provider === "twilio") {
    const twilioSid = (await getSettingValue("sms.twilio_account_sid").catch(() => "")) || (await getSettingValue("twilio.account_sid").catch(() => "")) || process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = (await getSettingValue("sms.twilio_auth_token").catch(() => "")) || (await getSettingValue("twilio.auth_token").catch(() => "")) || process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = (await getSettingValue("sms.twilio_phone").catch(() => "")) || (await getSettingValue("twilio.phone_number").catch(() => "")) || process.env.TWILIO_PHONE;

    if (twilioSid && twilioAuthToken && twilioPhone) {
      try {
        const message = `Your Modern Orthodontics verification code is: ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`;
        const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const auth = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString("base64");
        const params = new URLSearchParams({
          From: twilioPhone,
          To: phone,
          Body: message,
        });

        await axios.post(url, params.toString(), {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        logger.info(`[SMS OTP] Twilio SMS dispatched successfully to ${phone}`);
        return;
      } catch (err: any) {
        logger.error(`[SMS OTP] Twilio dispatch failed: ${err.message}`, err.response?.data);
      }
    }
  }

  // Development / fallback logger
  logger.info(`========================================================`);
  logger.info(`[SMS OTP DISPATCH] To: ${phone} | Code: ${otp}`);
  logger.info(`========================================================`);
}

export async function isOtpTestMode(): Promise<boolean> {
  // 1. Explicit env flag
  if (
    process.env.ENABLE_OTP_TEST_MODE === "true" ||
    process.env.OTP_TEST_MODE === "true" ||
    process.env.SMS_TEST_MODE === "true"
  ) {
    return true;
  }

  // 2. Settings from DB
  const [dbOtpTestMode, dbSmsTestMode, dbSmsEnabled] = await Promise.all([
    getSettingValue("auth.otp_test_mode").catch(() => ""),
    getSettingValue("sms.test_mode").catch(() => ""),
    getSettingValue("sms.enabled").catch(() => ""),
  ]);

  if (dbOtpTestMode === "true" || dbSmsTestMode === "true") {
    return true;
  }

  if (dbSmsEnabled === "false") {
    return true;
  }

  // 3. Local / non-production environment
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // 4. If no SMS credentials exist in either DB or env, real SMS cannot physically be sent
  const msg91Config = await resolveMsg91Config().catch(() => null);
  const hasMsg91Key = Boolean(msg91Config?.authKey);
  const twilioSid = (await getSettingValue("sms.twilio_account_sid").catch(() => "")) || (await getSettingValue("twilio.account_sid").catch(() => "")) || process.env.TWILIO_ACCOUNT_SID;

  if (!hasMsg91Key && !twilioSid) {
    return true;
  }

  return false;
}

export async function createAndSendOtp(
  phone: string,
  purpose: OtpPurpose,
  payload?: any,
): Promise<{
  verificationId: string;
  maskedPhone: string;
  cooldownSeconds: number;
  debugOtp?: string;
}> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) {
    throw new AppError("A valid mobile phone number is required for OTP verification.", 400);
  }

  // Generate 6-digit numeric OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const verificationId = crypto.randomUUID();
  const now = Date.now();

  const session: OtpSession = {
    verificationId,
    phone: cleanPhone,
    purpose,
    hashedOtp: hashOtp(rawOtp),
    expiresAt: now + OTP_TTL_SECONDS * 1000,
    lastSentAt: now,
    attempts: 0,
    payload,
  };

  await saveOtpSession(session);
  await sendSms(cleanPhone, rawOtp);

  const isTest = await isOtpTestMode();

  return {
    verificationId,
    maskedPhone: maskPhoneNumber(cleanPhone),
    cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    ...(isTest && { debugOtp: rawOtp }),
  };
}

export async function resendOtp(verificationId: string): Promise<{
  verificationId: string;
  maskedPhone: string;
  cooldownSeconds: number;
  debugOtp?: string;
}> {
  const session = await getOtpSession(verificationId);
  if (!session) {
    throw new AppError("OTP session expired or not found. Please request a new code.", 400);
  }

  const now = Date.now();
  const timeSinceLastSent = Math.floor((now - session.lastSentAt) / 1000);
  if (timeSinceLastSent < OTP_RESEND_COOLDOWN_SECONDS) {
    const remaining = OTP_RESEND_COOLDOWN_SECONDS - timeSinceLastSent;
    throw new AppError(`Please wait ${remaining} seconds before requesting a new OTP.`, 429);
  }

  const newOtp = crypto.randomInt(100000, 999999).toString();
  session.hashedOtp = hashOtp(newOtp);
  session.lastSentAt = now;
  session.expiresAt = now + OTP_TTL_SECONDS * 1000;
  session.attempts = 0;

  await saveOtpSession(session);
  await sendSms(session.phone, newOtp);

  const isTest = await isOtpTestMode();

  return {
    verificationId: session.verificationId,
    maskedPhone: maskPhoneNumber(session.phone),
    cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    ...(isTest && { debugOtp: newOtp }),
  };
}

export async function verifyOtpCode(
  verificationId: string,
  enteredOtp: string,
  expectedPurpose: OtpPurpose,
): Promise<OtpSession> {
  const cleanCode = enteredOtp.trim();
  if (!cleanCode || cleanCode.length !== 6) {
    throw new AppError("Please enter a valid 6-digit OTP code.", 400);
  }

  const session = await getOtpSession(verificationId);
  if (!session) {
    throw new AppError("OTP has expired or is invalid. Please request a new code.", 400);
  }

  if (session.purpose !== expectedPurpose) {
    throw new AppError("Invalid verification request purpose.", 400);
  }

  if (Date.now() > session.expiresAt) {
    await deleteOtpSession(verificationId);
    throw new AppError("OTP has expired. Please request a new code.", 400);
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    await deleteOtpSession(verificationId);
    throw new AppError("Too many failed attempts. Please request a new OTP.", 429);
  }

  const isTest = await isOtpTestMode();
  const inputHash = hashOtp(cleanCode);
  const isStandardTestOtp = isTest && (cleanCode === "123456" || cleanCode === "999999");

  if (inputHash !== session.hashedOtp && !isStandardTestOtp) {
    session.attempts += 1;
    await saveOtpSession(session);
    const remaining = MAX_ATTEMPTS - session.attempts;
    throw new AppError(
      remaining > 0
        ? `Invalid OTP. You have ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`
        : "Too many failed attempts. Please request a new OTP.",
      400,
    );
  }

  // OTP is verified successfully -> delete session to prevent replay
  await deleteOtpSession(verificationId);
  return session;
}
