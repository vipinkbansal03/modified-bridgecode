"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappAdminService, WhatsAppTemplatePayload, WhatsAppTemplateListFilters, WhatsAppTemplateTestPayload } from "@/services/whatsappAdminService";

export function useWhatsAppTemplates(filters: WhatsAppTemplateListFilters = {}) {
  return useQuery({
    queryKey: ["whatsappTemplates", filters],
    queryFn: () => whatsappAdminService.listTemplates(filters),
  });
}

export function useWhatsAppTemplate(id: string) {
  return useQuery({
    queryKey: ["whatsappTemplate", id],
    queryFn: () => whatsappAdminService.getTemplate(id),
    enabled: !!id,
  });
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { payload: WhatsAppTemplatePayload; builder?: unknown }) =>
      whatsappAdminService.createTemplate(variables.payload, variables.builder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplates"] });
    },
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; payload: WhatsAppTemplatePayload; builder?: unknown }) =>
      whatsappAdminService.updateTemplate(variables.id, variables.payload, variables.builder),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplate", variables.id] });
    },
  });
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => whatsappAdminService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplates"] });
    },
  });
}

export function useRefreshWhatsAppTemplateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => whatsappAdminService.refreshTemplateStatus(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["whatsappTemplate", id] });
    },
  });
}

export function useSendTestWhatsAppTemplate() {
  return useMutation({
    mutationFn: (variables: { id: string; payload: WhatsAppTemplateTestPayload }) =>
      whatsappAdminService.sendTestTemplate(variables.id, variables.payload),
  });
}
