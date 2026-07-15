import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

type ProductContentInput = {
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  highlights?: Array<{ title: string; description: string }>;
  technicalSpecs?: Array<{ label: string; value: string }>;
  warranty?: string[];
  primaryFeatures?: Array<{ title: string; description: string }>;
  productCode?: string | null;
  brand?: string | null;
};

export type GeneratedProductContent = {
  title: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  highlights: Array<{ title: string; description: string }>;
  technicalSpecs: Array<{ label: string; value: string }>;
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string }>;
};

const productContentKeys: Array<keyof GeneratedProductContent> = [
  "title",
  "shortDescription",
  "description",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "highlights",
  "technicalSpecs",
  "warranty",
  "primaryFeatures",
];

export async function generateProductContent(product: ProductContentInput | string, targetLanguage = "English") {
  const source = typeof product === "string" ? { title: product } : product;
  const protectedTerms = await prisma.protectedKeyword.findMany({
    select: { term: true },
    orderBy: { term: "asc" },
  });
  const protectedList = protectedTerms.map((row) => row.term);
  const brandTerms = [source.brand, source.productCode].filter(Boolean) as string[];
  const allProtected = Array.from(new Set([...protectedList, ...brandTerms]));

  const generated = await translateJson<GeneratedProductContent>({
    targetLanguage,
    fields: {
      title: source.title,
      shortDescription: source.shortDescription ?? "",
      description: source.description ?? "",
      seoTitle: source.seoTitle ?? source.title,
      seoDescription: source.seoDescription ?? source.shortDescription ?? "",
      seoKeywords: source.seoKeywords ?? "",
      highlights: source.highlights ?? [],
      technicalSpecs: source.technicalSpecs ?? [],
      warranty: source.warranty ?? [],
      primaryFeatures: source.primaryFeatures ?? [],
    },
    requiredKeys: productContentKeys,
    context: [
      "This is orthodontic ecommerce product content.",
      source.brand ? `Brand: ${source.brand}` : "",
      source.productCode ? `Product code: ${source.productCode}` : "",
      allProtected.length
        ? `Never translate these protected terms; keep them exactly as written: ${allProtected.join(", ")}`
        : "Preserve brand names, product codes, model names, HTML tags, URLs, measurements, and technical orthodontic terms when they should remain unchanged.",
      "Keep the array structure for highlights, technicalSpecs, warranty, and primaryFeatures exactly the same; translate only the human-readable text inside them.",
      "Return concise, natural ecommerce copy in the target language.",
    ].filter(Boolean).join("\n"),
  });

  return generated;
}

export async function translateText(text: string, targetLanguage: string) {
  const protectedTerms = await prisma.protectedKeyword.findMany({
    select: { term: true },
    orderBy: { term: "asc" },
  });
  const protectedList = protectedTerms.map((row) => row.term).join(", ");

  const result = await translateJson<{ translated: string }>({
    targetLanguage,
    fields: { translated: text },
    requiredKeys: ["translated"],
    context: [
      "Translate the text naturally.",
      protectedList ? `Never translate these protected terms; keep them exactly as written: ${protectedList}` : "",
      "Preserve brand names, product codes, URLs, HTML tags, and measurements.",
    ].filter(Boolean).join(" "),
  });

  return { translated: result.translated, language: targetLanguage };
}

async function translateJson<T extends Record<string, unknown>>({
  targetLanguage,
  fields,
  requiredKeys,
  context,
}: {
  targetLanguage: string;
  fields: Record<string, unknown>;
  requiredKeys: string[];
  context: string;
}): Promise<T> {
  if ((process.env.AI_PROVIDER || "openai").toLowerCase() !== "openai") {
    throw new AppError("Only the OpenAI AI provider is currently supported.", 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OPENAI_API_KEY is not configured.", 400);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a professional ecommerce localization specialist.",
            "Return only valid JSON.",
            "Use exactly the same JSON keys provided by the user.",
            "Do not add explanations, markdown, comments, or extra keys.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            task: `Translate these fields into ${targetLanguage}.`,
            context,
            fields,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(`AI request failed: ${body || response.statusText}`, 502);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new AppError("AI response did not include translated content.", 502);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError("AI response was not valid JSON.", 502);
  }

  const output: Record<string, string> = {};
  for (const key of requiredKeys) {
    const value = parsed[key];
    output[key] = typeof value === "string" ? value : "";
  }

  return output as T;
}
