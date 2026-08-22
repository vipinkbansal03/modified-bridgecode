import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import * as tataAdminProvider from "../../services/whatsapp/tata.admin.provider";

function normalizeTemplateId(id: string): string {
  return String(id || "").trim();
}

function getTemplateLanguage(language: any): string {
  if (typeof language === "string") return language.trim();
  return String(language?.code || "").trim();
}

function resolveTemplateStatus(status: string = ""): string {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PENDING", "APPROVED", "REJECTED"].includes(normalized)) return normalized;
  return "UNKNOWN";
}

function normalizeCategory(category: string = ""): string {
  const normalized = String(category || "").trim().toUpperCase();
  if (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(normalized)) return normalized;
  return "MARKETING";
}

function normalizeProviderCreatePayload(payload: any = {}) {
  const language = getTemplateLanguage(payload.language);
  const category = normalizeCategory(payload.category);
  const messageSendTtlSeconds = category === "AUTHENTICATION"
    ? 600
    : payload.message_send_ttl_seconds;
  return {
    ...payload,
    language: language || payload.language,
    category,
    ...(category === "AUTHENTICATION" ? { message_send_ttl_seconds: messageSendTtlSeconds } : {}),
  };
}

function extractProviderTemplates(response: any): any[] {
  if (Array.isArray(response)) return response;
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.templates)) return response.templates;
  if (Array.isArray(data?.templates)) return data.templates;
  if (Array.isArray(response?.result)) return response.result;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

async function syncTemplatesFromProvider(query: any = {}) {
  const providerResponse = await tataAdminProvider.listTemplates({
    category: query.category,
    status: query.status,
    search: query.search,
  });

  const remoteTemplates = extractProviderTemplates(providerResponse);
  if (!remoteTemplates.length) {
    return { synced: 0 };
  }

  const now = new Date();
  let synced = 0;

  for (const item of remoteTemplates) {
    const name = String(item?.name || "").trim();
    const language = getTemplateLanguage(item?.language);
    if (!name || !language) continue;

    const category = normalizeCategory(item?.category);
    const subCategory = String(item?.sub_category || item?.subCategory || "").trim().toUpperCase();
    const messageSendTtlSeconds = item?.message_send_ttl_seconds !== undefined && item?.message_send_ttl_seconds !== null && item?.message_send_ttl_seconds !== ""
      ? Number(item.message_send_ttl_seconds)
      : null;
    const components = Array.isArray(item?.components) ? item.components : [];

    await prisma.whatsAppTemplate.upsert({
      where: {
        name_language: { name, language },
      },
      update: {
        category,
        subCategory: ["ORDER_STATUS", "ORDER_DETAILS"].includes(subCategory) ? subCategory : "",
        messageSendTtlSeconds: Number.isFinite(messageSendTtlSeconds) ? messageSendTtlSeconds : null,
        status: resolveTemplateStatus(item?.status),
        payload: {
          name,
          language,
          category,
          ...(components.length ? { components } : {}),
        },
        providerTemplateId: String(item?.id || item?.template_id || item?.templateId || "").trim(),
        providerResponse: item || null,
        syncPayload: item || null,
        syncMessage: String(item?.rejected_reason || item?.message || "").trim(),
        lastSyncedAt: now,
        archivedAt: null,
        archivedBy: null,
      },
      create: {
        name,
        language,
        category,
        subCategory: ["ORDER_STATUS", "ORDER_DETAILS"].includes(subCategory) ? subCategory : "",
        messageSendTtlSeconds: Number.isFinite(messageSendTtlSeconds) ? messageSendTtlSeconds : null,
        status: resolveTemplateStatus(item?.status),
        payload: {
          name,
          language,
          category,
          ...(components.length ? { components } : {}),
        },
        providerTemplateId: String(item?.id || item?.template_id || item?.templateId || "").trim(),
        providerResponse: item || null,
        syncPayload: item || null,
        syncMessage: String(item?.rejected_reason || item?.message || "").trim(),
        lastSyncedAt: now,
        archivedAt: null,
        archivedBy: null,
        createdBy: null,
      },
    });

    synced++;
  }

  return { synced };
}

export async function listTemplates(query: any = {}) {
  const shouldSyncRemote = String(query.syncRemote || "true").toLowerCase() !== "false";
  if (shouldSyncRemote) {
    try {
      await syncTemplatesFromProvider(query);
    } catch (error) {
      logger.error("[WhatsApp Admin Service] Failed to sync templates from provider", error);
    }
  }

  const whereClause: any = {
    archivedAt: null,
  };

  if (query.status) {
    whereClause.status = String(query.status).trim().toUpperCase();
  }
  if (query.category) {
    whereClause.category = String(query.category).trim().toUpperCase();
  }
  if (query.search) {
    const searchStr = String(query.search).trim();
    whereClause.OR = [
      { name: { contains: searchStr, mode: "insensitive" } },
      { language: { contains: searchStr, mode: "insensitive" } },
      { status: { contains: searchStr, mode: "insensitive" } },
    ];
  }

  return prisma.whatsAppTemplate.findMany({
    where: whereClause,
    orderBy: [
      { updatedAt: "desc" },
    ],
  });
}

export async function getTemplateById(id: string) {
  const templateId = normalizeTemplateId(id);
  if (!templateId) return null;

  // Try finding by ID
  let template = await prisma.whatsAppTemplate.findUnique({
    where: { id: templateId },
  });

  // Fallback to name search
  if (!template) {
    template = await prisma.whatsAppTemplate.findFirst({
      where: { name: templateId },
    });
  }

  return template;
}

async function saveTemplateRecord(payload: any, providerResponse: any, actorId: string | null, builderState: any = null) {
  const templateData: any = {
    name: String(payload.name || "").trim(),
    language: getTemplateLanguage(payload.language),
    category: String(payload.category || "").trim().toUpperCase(),
    subCategory: String(payload.sub_category || "").trim().toUpperCase() || "",
    messageSendTtlSeconds: payload.message_send_ttl_seconds !== undefined && payload.message_send_ttl_seconds !== null && payload.message_send_ttl_seconds !== ""
      ? Number(payload.message_send_ttl_seconds)
      : null,
    payload: payload || null,
    builderState: builderState || null,
    providerResponse: providerResponse || null,
    providerTemplateId: String(providerResponse?.id || providerResponse?.template_id || providerResponse?.templateId || "").trim(),
    status: "PENDING",
    syncPayload: providerResponse || null,
    syncMessage: "",
    lastSubmittedAt: new Date(),
    lastSyncedAt: new Date(),
    archivedAt: null,
    archivedBy: null,
    updatedBy: actorId || null,
  };

  const name = templateData.name;
  const language = templateData.language;

  return prisma.whatsAppTemplate.upsert({
    where: {
      name_language: { name, language },
    },
    update: templateData,
    create: {
      ...templateData,
      createdBy: actorId || null,
    },
  });
}

export async function createTemplateRecord(payload: any, actorId: string | null, builderState: any = null) {
  const providerPayload = normalizeProviderCreatePayload(payload);
  const providerResponse = await tataAdminProvider.createTemplate(providerPayload);
  return saveTemplateRecord(providerPayload, providerResponse, actorId, builderState);
}

async function removeRemoteTemplateRecord(template: any, { allowMissing = true } = {}) {
  const remoteLocalTemplate = await tataAdminProvider.findLocalTemplateMessage({
    name: template.name,
    languageCode: template.language,
    providerTemplateId: template.providerTemplateId,
    channel: "whatsappBSP",
  });

  if (!remoteLocalTemplate?.id && !remoteLocalTemplate?._id) {
    if (allowMissing) {
      return { state: "not_found" };
    }
    const error: any = new Error("Provider template record was not found");
    error.statusCode = 404;
    throw error;
  }

  const remoteId = String(remoteLocalTemplate.id || remoteLocalTemplate._id);
  await tataAdminProvider.deleteTemplateMessage({
    name: template.name,
    channel: "whatsappBSP",
    id: remoteId,
  });

  return { state: "deleted", remoteId };
}

export async function updateTemplateRecord(id: string, payload: any, actorId: string | null, builderState: any = null) {
  const templateDoc = await getTemplateById(id);
  if (!templateDoc) {
    const error: any = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const providerPayload = normalizeProviderCreatePayload(payload);
  const existingName = String(templateDoc.name || "").trim();
  const existingLanguage = getTemplateLanguage(templateDoc.language);
  const nextName = String(providerPayload.name || "").trim();
  const nextLanguage = getTemplateLanguage(providerPayload.language);
  const identityChanged = existingName !== nextName || existingLanguage !== nextLanguage;

  await removeRemoteTemplateRecord({
    name: existingName,
    language: existingLanguage,
    providerTemplateId: templateDoc.providerTemplateId,
  });

  const providerResponse = await tataAdminProvider.createTemplate(providerPayload);
  const updated = await saveTemplateRecord(providerPayload, providerResponse, actorId, builderState);

  await prisma.whatsAppTemplate.update({
    where: { id: updated.id },
    data: {
      syncMessage: identityChanged
        ? "Template updated and re-submitted to provider"
        : "Template updated and re-synced to provider",
    },
  });

  return getTemplateById(updated.id);
}

export async function refreshTemplateStatus(id: string) {
  const templateDoc = await getTemplateById(id);
  if (!templateDoc) {
    const error: any = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const providerStatus = await tataAdminProvider.getTemplateStatus({
    name: templateDoc.name,
    language: templateDoc.language,
  });

  const resolvedStatus = resolveTemplateStatus(
    (providerStatus as any)?.data?.status || (providerStatus as any)?.status || (providerStatus as any)?.template?.status || templateDoc.status
  );

  return prisma.whatsAppTemplate.update({
    where: { id: templateDoc.id },
    data: {
      status: resolvedStatus,
      providerResponse: (providerStatus as any) || Prisma.JsonNull,
      syncPayload: (providerStatus as any) || Prisma.JsonNull,
      syncMessage: (providerStatus as any)?.message || (providerStatus as any)?.description || "",
      lastSyncedAt: new Date(),
    },
  });
}

export async function deleteTemplateRecord(id: string, actorId: string | null) {
  const templateDoc = await getTemplateById(id);
  if (!templateDoc) {
    const error: any = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const remoteDelete = await removeRemoteTemplateRecord(templateDoc);
  const remoteDeleteState = remoteDelete.state === "not_found" ? "already_deleted" : remoteDelete.state;

  return prisma.whatsAppTemplate.update({
    where: { id: templateDoc.id },
    data: {
      archivedAt: new Date(),
      archivedBy: actorId || null,
      updatedBy: actorId || null,
      syncMessage: `Deleted locally after provider sync (${remoteDeleteState})`,
    },
  });
}

export async function sendTestTemplate(id: string, to: string) {
  const templateDoc = await getTemplateById(id);
  if (!templateDoc) {
    const error: any = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const payload: any = templateDoc.payload;
  const response = await tataAdminProvider.sendTemplateMessage({
    to,
    type: "template",
    source: "admin",
    template: {
      name: templateDoc.name,
      language: { code: templateDoc.language },
      components: Array.isArray(payload?.components) ? payload.components : [],
    },
  });

  await prisma.whatsAppTemplate.update({
    where: { id: templateDoc.id },
    data: {
      lastTestSentAt: new Date(),
      syncPayload: (response as any) || Prisma.JsonNull,
    },
  });

  return {
    response,
    template: await getTemplateById(templateDoc.id),
  };
}

export async function getTemplateStatusDirect(params: { name: string; language: string }) {
  return tataAdminProvider.getTemplateStatus(params);
}

export async function getTemplateInsights(query: any) {
  if (query.name && query.language) {
    return tataAdminProvider.getTemplateInsightsByName(query);
  }
  return tataAdminProvider.getTemplateInsights(query);
}

export async function enableTemplateInsights() {
  return tataAdminProvider.enableTemplateInsights();
}

export async function updateOptInOut(payload: any) {
  return tataAdminProvider.optInOptOut(payload);
}
