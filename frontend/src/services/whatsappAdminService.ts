import { adminApi } from "@/services/adminApi";

export type WhatsAppTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type WhatsAppTemplateStatus = "PENDING" | "APPROVED" | "REJECTED" | "UNKNOWN";
export type WhatsAppTemplateSubCategory = "ORDER_STATUS" | "ORDER_DETAILS";

export type WhatsAppTemplatePayload = {
  name: string;
  language: string | { code: string };
  category: WhatsAppTemplateCategory;
  sub_category?: WhatsAppTemplateSubCategory;
  message_send_ttl_seconds?: number;
  components: Array<Record<string, unknown>>;
};

export type WhatsAppTemplateRecord = {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  subCategory?: WhatsAppTemplateSubCategory | "";
  messageSendTtlSeconds?: number | null;
  status: WhatsAppTemplateStatus;
  payload: WhatsAppTemplatePayload;
  builderState?: any;
  providerResponse?: any;
  providerTemplateId?: string;
  syncMessage?: string;
  lastSubmittedAt?: string | null;
  lastSyncedAt?: string | null;
  lastTestSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppTemplateListFilters = {
  search?: string;
  category?: string;
  status?: string;
  syncRemote?: string;
};

export type WhatsAppTemplateTestPayload = {
  to: string;
};

export const whatsappAdminService = {
  listTemplates: async (filters: WhatsAppTemplateListFilters = {}) => {
    const res = await adminApi.get<{ data: { templates: WhatsAppTemplateRecord[] } }>("/whatsapp/templates", { params: filters });
    return res.data.data.templates || [];
  },
  getTemplate: async (id: string) => {
    const res = await adminApi.get<{ data: { template: WhatsAppTemplateRecord } }>(`/whatsapp/templates/${encodeURIComponent(id)}`);
    return res.data.data.template;
  },
  createTemplate: async (payload: WhatsAppTemplatePayload, builder?: unknown) => {
    const res = await adminApi.post<{ data: { template: WhatsAppTemplateRecord } }>("/whatsapp/templates", { payload, builder });
    return res.data.data.template;
  },
  updateTemplate: async (id: string, payload: WhatsAppTemplatePayload, builder?: unknown) => {
    const res = await adminApi.patch<{ data: { template: WhatsAppTemplateRecord } }>(`/whatsapp/templates/${encodeURIComponent(id)}`, { payload, builder });
    return res.data.data.template;
  },
  deleteTemplate: async (id: string) => {
    const res = await adminApi.delete<{ data: { template: WhatsAppTemplateRecord; deleted: boolean } }>(`/whatsapp/templates/${encodeURIComponent(id)}`);
    return res.data.data;
  },
  refreshTemplateStatus: async (id: string) => {
    const res = await adminApi.post<{ data: { template: WhatsAppTemplateRecord } }>(`/whatsapp/templates/${encodeURIComponent(id)}/refresh`);
    return res.data.data.template;
  },
  sendTestTemplate: async (id: string, payload: WhatsAppTemplateTestPayload) => {
    const res = await adminApi.post<{ data: { response: unknown; template: WhatsAppTemplateRecord } }>(
      `/whatsapp/templates/${encodeURIComponent(id)}/send-test`,
      payload
    );
    return res.data.data;
  },
  getTemplateStatus: async (name: string, language: string) => {
    const res = await adminApi.get<{ data: { result: Record<string, unknown> } }>("/whatsapp/templates/status", {
      params: { name, language },
    });
    return res.data.data.result;
  },
  getTemplateInsights: async (params: Record<string, string>) => {
    const res = await adminApi.get<{ data: { result: Record<string, unknown> } }>("/whatsapp/templates/insights", {
      params,
    });
    return res.data.data.result;
  },
  enableTemplateInsights: async () => {
    const res = await adminApi.post<{ data: { result: Record<string, unknown> } }>("/whatsapp/templates/insights/optin");
    return res.data.data.result;
  },
  updateConsent: async (payload: any) => {
    const res = await adminApi.post<{ data: { result: Record<string, unknown> } }>("/whatsapp/consent", payload);
    return res.data.data.result;
  },
};
