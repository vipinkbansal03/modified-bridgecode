import { adminApi } from "@/services/adminApi";

export type ThemeTokens = {
  primary: string;
  accent: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  headingFont: string;
  bodyFont: string;
};

export const defaultThemeTokens: ThemeTokens = {
  primary: "#0F6B78",
  accent: "#E45B3F",
  surface: "#F7FAFB",
  textPrimary: "#102A33",
  textSecondary: "#52656D",
  border: "#D8E2E5",
  headingFont: "Manrope",
  bodyFont: "Inter",
};

const keys: Record<keyof ThemeTokens, string> = {
  primary: "theme.primary",
  accent: "theme.accent",
  surface: "theme.surface",
  textPrimary: "theme.text_primary",
  textSecondary: "theme.text_secondary",
  border: "theme.border",
  headingFont: "theme.heading_font",
  bodyFont: "theme.body_font",
};

type SettingRow = { key: string; value: string };

export function mapThemeSettings(rows: SettingRow[] | undefined): ThemeTokens {
  const settings = new Map((rows ?? []).map((row) => [row.key, row.value]));
  return Object.entries(keys).reduce((result, [token, key]) => {
    result[token as keyof ThemeTokens] = settings.get(key) || defaultThemeTokens[token as keyof ThemeTokens];
    return result;
  }, { ...defaultThemeTokens });
}

export async function getThemeSettings() {
  const response = await adminApi.get("/settings", { params: { group: "theme" } });
  return mapThemeSettings(response.data.data as SettingRow[]);
}

export async function saveThemeSettings(theme: ThemeTokens) {
  const settings = Object.entries(keys).map(([token, key]) => ({
    key,
    value: theme[token as keyof ThemeTokens],
    group: "theme",
    label: `Storefront ${token}`,
    type: "string",
  }));
  await adminApi.put("/settings", { settings });
}
