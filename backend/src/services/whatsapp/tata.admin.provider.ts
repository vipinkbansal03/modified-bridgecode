import { getSettingValue } from "../../modules/settings/settings.service";

export interface TataCredentials {
  baseUrl: string;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  bearerToken: string;
  botId: string;
}

export async function resolveTataCredentials(): Promise<TataCredentials> {
  const baseUrl = (await getSettingValue("whatsapp.tata_base_url")) || process.env.TATA_TELECOM_BASE_URL || "";
  const apiBaseUrl = (await getSettingValue("whatsapp.tata_api_base_url")) || process.env.TATA_TELECOM_API_BASE_URL || "";
  const apiKey = (await getSettingValue("whatsapp.tata_api_key")) || process.env.TATA_TELECOM_API_KEY || "";
  const apiSecret = (await getSettingValue("whatsapp.tata_api_secret")) || process.env.TATA_TELECOM_API_SECRET || "";
  const bearerToken =
    (await getSettingValue("whatsapp.tata_bearer_token")) ||
    (await getSettingValue("whatsapp.tata_api_secret")) ||
    process.env.TATA_TELECOM_BEARER_TOKEN ||
    process.env.TATA_TELECOM_API_SECRET ||
    "";
  const botId = (await getSettingValue("whatsapp.tata_bot_id")) || process.env.TATA_TELECOM_BOT_ID || "";

  return {
    baseUrl: baseUrl.trim(),
    apiBaseUrl: apiBaseUrl.trim() || (baseUrl ? baseUrl.trim().replace("://wb.", "://api.") : ""),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    bearerToken: bearerToken.trim().replace(/^[^a-zA-Z0-9]+/, ""),
    botId: botId.trim(),
  };
}

async function getClient() {
  const credentials = await resolveTataCredentials();

  if (!credentials.baseUrl) {
    const error: any = new Error("Tata WhatsApp base URL is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (!credentials.bearerToken && !credentials.apiKey) {
    const error: any = new Error("Tata WhatsApp admin credentials are not configured");
    error.statusCode = 500;
    throw error;
  }

  return { credentials };
}

async function parseBody(response: Response): Promise<any> {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => "");
}

function buildUrl(baseUrl: string, path: string, query: Record<string, any> = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function buildError(response: Response, body: any, fallbackMessage?: string) {
  const message =
    typeof body === "object" && body !== null
      ? body.message || body.error || body.description || fallbackMessage
      : String(body || fallbackMessage || "Request failed");
  const error: any = new Error(message);
  error.statusCode = response.status;
  error.providerPayload = body;
  return error;
}

function ensureBotId(credentials: TataCredentials) {
  const botId = String(credentials?.botId || "").trim();
  if (!botId) {
    const error: any = new Error("Tata Omni botId is not configured. Set TATA_TELECOM_BOT_ID.");
    error.statusCode = 500;
    throw error;
  }
  return botId;
}

async function request(method: string, path: string, options: { query?: Record<string, any>; payload?: any; fallbackMessage?: string } = {}): Promise<any> {
  const { credentials } = await getClient();

  const authHeaderCandidates: Record<string, string>[] = [];
  if (credentials.bearerToken) {
    authHeaderCandidates.push({
      Authorization: `Bearer ${credentials.bearerToken}`,
    });
  }
  if (credentials.apiKey) {
    authHeaderCandidates.push({
      "x-api-key": credentials.apiKey,
      ...(credentials.apiSecret ? { "x-api-secret": credentials.apiSecret } : {}),
    });
  }

  const baseUrls = [credentials.baseUrl];
  if (credentials.apiBaseUrl && credentials.apiBaseUrl !== credentials.baseUrl) {
    baseUrls.push(credentials.apiBaseUrl);
  }

  const execute = async (baseUrl: string, authHeaders: Record<string, string>) => {
    const response = await fetch(buildUrl(baseUrl, path, options.query), {
      method,
      headers: {
        ...authHeaders,
        ...(options.payload ? { "Content-Type": "application/json" } : {}),
      },
      body: options.payload ? JSON.stringify(options.payload) : undefined,
    });

    const body = await parseBody(response);
    return { response, body };
  };

  let lastResult = null;
  for (const baseUrl of baseUrls) {
    for (const authHeaders of authHeaderCandidates) {
      const result = await execute(baseUrl, authHeaders);
      if (result.response.ok) {
        return result.body;
      }

      lastResult = result;

      if (![401, 403, 404].includes(result.response.status)) {
        throw buildError(result.response, result.body, options.fallbackMessage || "Tata WhatsApp request failed");
      }
    }
  }

  if (!lastResult) {
    const error: any = new Error(options.fallbackMessage || "Tata WhatsApp request failed");
    error.statusCode = 500;
    throw error;
  }

  const error = buildError(lastResult.response, lastResult.body, options.fallbackMessage || "Tata WhatsApp request failed");
  if (error.statusCode === 401) {
    error.message = `${error.message}. Verify Tata Omni access token or API key in system settings.`;
  }
  throw error;
}

export async function createTemplate(payload: any) {
  return request("POST", "/templates", { payload, fallbackMessage: "Unable to create template" });
}

export async function listTemplates(query: Record<string, any> = {}) {
  return request("GET", "/templates", {
    query,
    fallbackMessage: "Unable to list templates",
  });
}

export async function listLocalTemplateMessages(query: Record<string, any> = {}) {
  const { credentials } = await getClient();
  const botId = ensureBotId(credentials);

  return request("GET", `/template-messages/${encodeURIComponent(botId)}/local`, {
    query: {
      page: query.page || 1,
      limit: query.limit || 20,
      channel: query.channel || "whatsappBSP",
      isAuth: query.isAuth !== false,
      isTemplateManager: query.isTemplateManager !== false,
    },
    fallbackMessage: "Unable to list local template messages",
  });
}

export async function findLocalTemplateMessage(params: { name: string; languageCode?: string; providerTemplateId?: string; channel?: string }) {
  const channel = params.channel || "whatsappBSP";
  const matchesTemplate = (item: any) => {
    if (item?.isArchived) return false;
    if (String(item?.name || "").trim() !== String(params.name || "").trim()) return false;
    if (params.providerTemplateId && String(item?.templateId || "").trim() !== String(params.providerTemplateId || "").trim()) return false;
    const code = String(item?.language?.code || "").trim();
    return !params.languageCode || code === String(params.languageCode || "").trim();
  };

  let page = 1;
  const limit = 200;

  while (page <= 25) {
    const response = await listLocalTemplateMessages({ channel, page, limit });
    const docs = Array.isArray(response?.docs)
      ? response.docs
      : Array.isArray(response?.data?.docs)
        ? response.data.docs
        : [];

    const matched = docs.find(matchesTemplate) || null;
    if (matched) {
      return matched;
    }

    const totalPagesRaw = response?.totalPages ?? response?.data?.totalPages;
    const totalPages = Number(totalPagesRaw || 0);
    if (!docs.length || (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages)) {
      break;
    }

    page += 1;
  }

  return null;
}

export async function deleteTemplateMessage(params: { name: string; id: string; channel?: string }) {
  const { credentials } = await getClient();
  const botId = ensureBotId(credentials);
  const channel = params.channel || "whatsappBSP";

  return request("DELETE", `/template-messages/${encodeURIComponent(botId)}`, {
    query: {
      name: params.name,
      channel,
      id: params.id,
    },
    fallbackMessage: "Unable to delete template message",
  });
}

export async function getTemplateStatus(params: { name: string; language: string }) {
  return request("GET", "/templates/template", {
    query: params,
    fallbackMessage: "Unable to fetch template status",
  });
}

export async function getTemplateInsights(params: { startDate: string; endDate: string; templateIDs: string; granularity: string }) {
  return request("GET", "/templates/insights", {
    query: params,
    fallbackMessage: "Unable to fetch template insights",
  });
}

export async function getTemplateInsightsByName(params: { name: string; language: string; startDate: string; endDate: string; granularity: string }) {
  return request("GET", "/templates/insights-by-name", {
    query: params,
    fallbackMessage: "Unable to fetch template insights by name",
  });
}

export async function enableTemplateInsights() {
  return request("POST", "/templates/insights/optin", {
    payload: {},
    fallbackMessage: "Unable to enable template insights",
  });
}

export async function optInOptOut(payload: any) {
  return request("POST", "/business/optin_optout", {
    payload,
    fallbackMessage: "Unable to update opt-in or opt-out status",
  });
}

export async function sendTemplateMessage(payload: any) {
  return request("POST", "/messages", {
    payload,
    fallbackMessage: "Unable to send template message",
  });
}
