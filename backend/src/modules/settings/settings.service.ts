import { prisma } from "../../config/database";
export async function getSettings(group?: string) {
  const settings = await prisma.setting.findMany({ where: group ? { group } : {}, orderBy: { key: "asc" } });
  return settings.map(s => ({ ...s, value: s.isSecret ? "***" : s.value }));
}
export async function updateSettings(updates: { key: string; value: string }[]) {
  return Promise.all(updates.map(({ key, value }) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
}
