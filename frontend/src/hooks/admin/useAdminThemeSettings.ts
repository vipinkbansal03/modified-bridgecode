import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getThemeSettings, saveThemeSettings, type ThemeTokens } from "@/services/themeSettingsService";

export function useAdminThemeSettings() {
  return useQuery({
    queryKey: ["admin-settings", "theme"],
    queryFn: getThemeSettings,
  });
}

export function useSaveAdminThemeSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: ThemeTokens) => saveThemeSettings(theme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings", "theme"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-settings"] });
    },
  });
}
