import { logger } from "../../config/logger";
import { getSettingValue } from "../settings/settings.service";

export interface Msg91ResolvedConfig {
  authKey: string;
  whatsappNumber: string;
  senderId: string;
  otpTemplateId: string;
  flowId: string;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
}

/**
 * Normalizes phone numbers to standard MSG91 international format (digits only without leading '+').
 * If 10 digits and matches Indian mobile pattern (starts with 6-9), prepends country code 91.
 */
export function normalizeMsg91Phone(value: string = ""): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  // If already prefixed with 0, remove leading zero and check 10 digits
  if (digits.length === 11 && digits.startsWith("0")) {
    const withoutZero = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(withoutZero)) {
      return `91${withoutZero}`;
    }
  }

  return digits;
}

/**
 * Resolves MSG91 credentials with graceful inheritance from Email settings or env.
 */
export async function resolveMsg91Config(): Promise<Msg91ResolvedConfig> {
  const [
    dbSmsKey,
    dbWaKey,
    dbEmailKey,
    dbWaNumber,
    dbTataSender,
    dbWaSettingNumber,
    dbSenderId,
    dbOtpTemplateId,
    dbFlowId,
    dbWaEnabled,
    dbSmsEnabled,
  ] = await Promise.all([
    getSettingValue("sms.msg91_auth_key").catch(() => ""),
    getSettingValue("whatsapp.msg91_auth_key").catch(() => ""),
    getSettingValue("email.msg91_auth_key").catch(() => ""),
    getSettingValue("whatsapp.msg91_integrated_number").catch(() => ""),
    getSettingValue("whatsapp.tata_sender").catch(() => ""),
    getSettingValue("whatsapp.number").catch(() => ""),
    getSettingValue("sms.msg91_sender_id").catch(() => ""),
    getSettingValue("sms.msg91_otp_template_id").catch(() => ""),
    getSettingValue("sms.msg91_flow_id").catch(() => ""),
    getSettingValue("whatsapp.enabled").catch(() => ""),
    getSettingValue("sms.enabled").catch(() => ""),
  ]);

  const authKey = (
    dbSmsKey ||
    dbWaKey ||
    dbEmailKey ||
    process.env.MSG91_AUTH_KEY ||
    ""
  ).trim();

  const whatsappNumber = (
    dbWaNumber ||
    process.env.MSG91_WHATSAPP_NUMBER ||
    dbTataSender ||
    dbWaSettingNumber ||
    ""
  ).trim();

  const senderId = (
    dbSenderId ||
    process.env.MSG91_SMS_SENDER_ID ||
    process.env.MSG91_SENDER_ID ||
    ""
  ).trim();

  const otpTemplateId = (
    dbOtpTemplateId ||
    process.env.MSG91_OTP_TEMPLATE_ID ||
    ""
  ).trim();

  const flowId = (
    dbFlowId ||
    process.env.MSG91_FLOW_ID ||
    ""
  ).trim();

  const whatsappEnabled = dbWaEnabled !== "false";
  const smsEnabled = dbSmsEnabled !== "false";

  return {
    authKey,
    whatsappNumber: normalizeMsg91Phone(whatsappNumber),
    senderId,
    otpTemplateId,
    flowId,
    whatsappEnabled,
    smsEnabled,
  };
}

/**
 * Dispatches an OTP via MSG91 OTP API (or Flow API if configured)
 */
export async function sendMsg91Otp(phone: string, otp: string): Promise<{ success: boolean; messageId?: string; mock?: boolean }> {
  const config = await resolveMsg91Config();
  const normalizedTo = normalizeMsg91Phone(phone);

  if (!config.smsEnabled) {
    logger.info(`[MSG91 SMS] SMS is disabled in settings. Skipping OTP to ${normalizedTo}`);
    return { success: true, mock: true };
  }

  if (!config.authKey) {
    logger.info(`[MSG91 OTP MOCK] AuthKey not set. To: ${normalizedTo} | OTP: ${otp}`);
    return { success: true, mock: true };
  }

  try {
    // 1. If OTP template ID is present, use MSG91 dedicated OTP API
    if (config.otpTemplateId) {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(config.otpTemplateId)}&mobile=${encodeURIComponent(normalizedTo)}&otp=${encodeURIComponent(otp)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "authkey": config.authKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ otp }),
      });

      const resData = (await res.json().catch(() => null)) as any;
      if (!res.ok || (resData && (resData.type === "error" || resData.status === "error"))) {
        const errorMsg = resData?.message || res.statusText;
        logger.error(`[MSG91 OTP Error] ${res.status}: ${errorMsg}`, resData);
        throw new Error(`MSG91 OTP dispatch failed: ${errorMsg}`);
      }

      logger.info(`[MSG91 OTP Sent] Successfully dispatched OTP to ${normalizedTo} (MessageId: ${resData?.message || "ok"})`);
      return { success: true, messageId: String(resData?.message || "") };
    }

    // 2. If Flow ID is configured, dispatch via MSG91 Flow API
    if (config.flowId) {
      const payload: Record<string, any> = {
        template_id: config.flowId,
        short_url: "0",
        mobiles: normalizedTo,
        otp,
        code: otp,
      };
      if (config.senderId) {
        payload.sender = config.senderId;
      }

      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "authkey": config.authKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resData = (await res.json().catch(() => null)) as any;
      if (!res.ok || (resData && (resData.type === "error" || resData.status === "error"))) {
        const errorMsg = resData?.message || res.statusText;
        logger.error(`[MSG91 Flow Error] ${res.status}: ${errorMsg}`, resData);
        throw new Error(`MSG91 Flow dispatch failed: ${errorMsg}`);
      }

      logger.info(`[MSG91 Flow Sent] Dispatched OTP flow to ${normalizedTo}`);
      return { success: true, messageId: String(resData?.message || "") };
    }

    // 3. Fallback: No template ID configured yet in MSG91 dashboard
    logger.warn(`[MSG91 Warning] Neither MSG91_OTP_TEMPLATE_ID nor Flow ID is configured. Logged OTP: ${otp} for ${normalizedTo}`);
    return { success: true, mock: true };
  } catch (err: any) {
    logger.error(`[MSG91 OTP Exception] Failed to send OTP to ${normalizedTo}: ${err.message}`);
    throw err;
  }
}

/**
 * Dispatches a WhatsApp template message via MSG91 Outbound Bulk WhatsApp API
 */
export async function sendMsg91WhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en",
  variables: string[] = [],
  payloadData: Record<string, any> = {}
): Promise<{ provider: string; response: any }> {
  const config = await resolveMsg91Config();
  const normalizedTo = normalizeMsg91Phone(to);

  if (!config.whatsappEnabled) {
    logger.info(`[MSG91 WhatsApp] WhatsApp notifications are disabled in settings. Skipping to ${normalizedTo}`);
    return { provider: "msg91-mock", response: { status: "disabled" } };
  }

  if (!config.authKey || !config.whatsappNumber) {
    logger.warn(`[MSG91 WhatsApp Mock] AuthKey or WhatsApp Integrated Number missing. Mock dispatch to ${normalizedTo} | Template: ${templateName}`);
    return { provider: "msg91-mock", response: { status: "mock", to: normalizedTo, template: templateName } };
  }

  // Build component parameters for MSG91 WhatsApp template
  const components: Record<string, any> = {};
  variables.forEach((varName, idx) => {
    const val = payloadData[varName] !== undefined ? String(payloadData[varName]) : "";
    components[`body_${idx + 1}`] = {
      type: "text",
      value: val,
    };
  });

  const payload = {
    integrated_number: config.whatsappNumber,
    content_type: "template",
    payload: {
      to: normalizedTo,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode || "en",
        },
        components: Object.keys(components).length ? components : undefined,
      },
    },
  };

  logger.info(`[MSG91 WhatsApp Template] Sending request to ${normalizedTo}`, { template: templateName });

  const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: {
      "authkey": config.authKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as any;

  if (!response.ok || (body && (body.status === "error" || body.type === "error"))) {
    const errMsg = body?.message || body?.error || `HTTP ${response.status} from MSG91`;
    logger.error(`[MSG91 WhatsApp Error] ${errMsg}`, body);
    throw new Error(`MSG91 WhatsApp failed: ${errMsg}`);
  }

  return { provider: "msg91", response: body };
}

/**
 * Dispatches a session / plain text WhatsApp message via MSG91
 */
export async function sendMsg91WhatsAppText(
  to: string,
  message: string
): Promise<{ provider: string; response: any }> {
  const config = await resolveMsg91Config();
  const normalizedTo = normalizeMsg91Phone(to);

  if (!config.whatsappEnabled) {
    logger.info(`[MSG91 WhatsApp] WhatsApp notifications are disabled in settings. Skipping text to ${normalizedTo}`);
    return { provider: "msg91-mock", response: { status: "disabled" } };
  }

  if (!config.authKey || !config.whatsappNumber) {
    logger.info(`[MSG91 WhatsApp Mock] Plain text to ${normalizedTo}: ${message}`);
    return { provider: "msg91-mock", response: { status: "mock", to: normalizedTo, message } };
  }

  const payload = {
    integrated_number: config.whatsappNumber,
    recipient_number: normalizedTo,
    content_type: "text",
    text: message,
  };

  const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
    method: "POST",
    headers: {
      "authkey": config.authKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as any;

  if (!response.ok || (body && (body.status === "error" || body.type === "error"))) {
    const errMsg = body?.message || body?.error || `HTTP ${response.status} from MSG91`;
    throw new Error(`MSG91 WhatsApp failed: ${errMsg}`);
  }

  return { provider: "msg91", response: body };
}

/**
 * Dispatches a transactional SMS via MSG91 Flow API
 */
export async function sendMsg91Sms(
  to: string,
  message: string,
  options: { templateId?: string; variables?: Record<string, any> } = {}
): Promise<{ success: boolean; response: any }> {
  const config = await resolveMsg91Config();
  const normalizedTo = normalizeMsg91Phone(to);

  if (!config.smsEnabled) {
    logger.info(`[MSG91 SMS] SMS notifications are disabled in settings. Skipping to ${normalizedTo}`);
    return { success: true, response: { status: "disabled" } };
  }

  if (!config.authKey) {
    logger.info(`[MSG91 SMS MOCK] To: ${normalizedTo} | Message: ${message}`);
    return { success: true, response: { status: "mock", to: normalizedTo, message } };
  }

  const templateId = options.templateId || config.flowId || config.otpTemplateId;
  if (!templateId) {
    logger.info(`[MSG91 SMS MOCK] No Flow Template ID configured. To: ${normalizedTo} | Message: ${message}`);
    return { success: true, response: { status: "no_template", to: normalizedTo, message } };
  }

  const payload: Record<string, any> = {
    template_id: templateId,
    short_url: "0",
    mobiles: normalizedTo,
    message,
    ...(options.variables || {}),
  };

  if (config.senderId) {
    payload.sender = config.senderId;
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      "authkey": config.authKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok || (body && (body.status === "error" || body.type === "error"))) {
    const errMsg = body?.message || body?.error || `HTTP ${response.status} from MSG91`;
    throw new Error(`MSG91 SMS failed: ${errMsg}`);
  }

  return { success: true, response: body };
}
