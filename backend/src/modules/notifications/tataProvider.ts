import { logger } from "../../config/logger";
import { getSettingValue } from "../settings/settings.service";

const FORCED_WHATSAPP_SENDER_CONTEXT = "9240213800";

export function normalizeIndianMobile(value: string = ""): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  // Extract last 10 digits if matching Indian pattern
  let cleanDigits = digits;
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      cleanDigits = last10;
    }
  }

  if (cleanDigits.length === 10) {
    return `+91${cleanDigits}`;
  }

  const fallback = digits.slice(-10);
  if (fallback.length === 10) {
    return `+91${fallback}`;
  }

  return `+91${digits.slice(0, 10)}`;
}

export async function sendTataTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  variables: string[],
  payloadData: Record<string, any>
) {
  const whatsappEnabled = await getSettingValue("whatsapp.enabled");
  if (whatsappEnabled === "false") {
    logger.info("[Tata WhatsApp] WhatsApp notifications are explicitly disabled in settings. Using mock response.");
    return { provider: "whatsapp-mock", status: "queued", referenceId: `wa_mock_${Date.now()}` };
  }

  const dbBaseUrl = await getSettingValue("whatsapp.tata_base_url");
  const dbBearerToken = await getSettingValue("whatsapp.tata_bearer_token");
  const dbSender = await getSettingValue("whatsapp.tata_sender");

  const baseUrl = (dbBaseUrl || process.env.TATA_TELECOM_BASE_URL || "").trim();
  const bearerToken = (dbBearerToken || process.env.TATA_TELECOM_BEARER_TOKEN || "").trim().replace(/^[^a-zA-Z0-9]+/, "");
  const whatsappSender = (dbSender || process.env.TATA_TELECOM_WHATSAPP_SENDER || FORCED_WHATSAPP_SENDER_CONTEXT).trim();

  if (!baseUrl || !bearerToken) {
    logger.warn("[Tata WhatsApp] Base URL or Bearer Token not configured in settings/env. Using mock response.");
    return { provider: "tata-mock", status: "queued", referenceId: `MOCK-${Date.now()}` };
  }

  const normalizedTo = normalizeIndianMobile(to);
  const parameters = variables.map((varName) => ({
    type: "text",
    text: String(payloadData[varName] !== undefined ? payloadData[varName] : ""),
  }));

  const payload = {
    to: normalizedTo,
    from: whatsappSender,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters,
        },
      ],
    },
  };

  logger.info("[Tata WhatsApp Template] Sending template message request", {
    url: `${baseUrl}/whatsapp-cloud/messages`,
    payload,
  });

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/whatsapp-cloud/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const bodyAny = body as any;
    const errMsg = typeof body === "object" && body !== null
      ? (bodyAny.message || bodyAny.error || bodyAny.description || "Tata Telecom error")
      : String(body || "Tata Telecom error");
    throw new Error(errMsg);
  }

  return { provider: "tata", response: body };
}
