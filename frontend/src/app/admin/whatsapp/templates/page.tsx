"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Search, Send, Upload, Eye, ChevronRight, LayoutGrid } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  useWhatsAppTemplates,
  useCreateWhatsAppTemplate,
  useUpdateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  useRefreshWhatsAppTemplateStatus,
  useSendTestWhatsAppTemplate,
} from "@/hooks/api/useWhatsAppTemplates";
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplatePayload,
  WhatsAppTemplateRecord,
  WhatsAppTemplateStatus,
} from "@/services/whatsappAdminService";
import "./whatsapp.css";

type HeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
type ComponentType = "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
type TemplateType =
  | "custom"
  | "form"
  | "carousel"
  | "limited_time_offer"
  | "coupon_code"
  | "catalog"
  | "voice_call"
  | "call_permission_request"
  | "order_status"
  | "order_details"
  | "authentication";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "OTP" | "FLOW" | "ORDER_DETAILS" | "CATALOG" | "MPM" | "VOICE_CALL";

type BuilderState = {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  templateType: TemplateType;
  subCategory: "" | "ORDER_STATUS" | "ORDER_DETAILS";
  messageSendTtlSeconds: string;
  components: BuilderComponent[];
};

type BuilderComponent =
  | { id: string; type: "HEADER"; format: HeaderFormat; text: string; exampleText: string; mediaHandle: string; location: { latitude: string; longitude: string; name: string; address: string } }
  | { id: string; type: "BODY"; text: string; exampleText: string }
  | { id: string; type: "FOOTER"; text: string }
  | { id: string; type: "BUTTONS"; buttons: BuilderButton[] }
  | { id: string; type: "CAROUSEL"; cards: CarouselCard[] }
  | { id: string; type: "LIMITED_TIME_OFFER"; text: string; hasExpiration: boolean; expirationTimeMs: string }
  | { id: string; type: "AUTHENTICATION"; bodyText: string; securityRecommendation: boolean; codeExpirationMinutes: string; buttonText: string }
  | { id: string; type: "CALL_PERMISSION_REQUEST" }
  | { id: string; type: "CUSTOM"; componentType: string; json: string };

type BuilderButton = {
  id: string;
  type: ButtonType;
  text: string;
  url: string;
  phoneNumber: string;
  example: string;
  flowId: string;
  navigateScreen: string;
  flowAction: string;
  otpType: string;
  payload: string;
  extraJson: string;
};

type CarouselCard = {
  id: string;
  headerType: HeaderFormat;
  headerText: string;
  mediaHandle: string;
  bodyText: string;
  buttons: BuilderButton[];
};

type TemplateTypeConfig = {
  label: string;
  description: string;
  requiredComponents: string[];
  optionalComponents?: string[];
  allowedButtonTypes?: ButtonType[];
  allowMediaHeader?: boolean;
  allowLocationHeader?: boolean;
  allowFooter?: boolean;
  allowHeader?: boolean;
};

const TEMPLATE_TYPE_OPTIONS: Record<WhatsAppTemplateCategory, TemplateType[]> = {
  MARKETING: ["custom", "form", "carousel", "limited_time_offer", "coupon_code", "catalog", "voice_call", "call_permission_request"],
  UTILITY: ["custom", "form", "order_status", "order_details", "catalog"],
  AUTHENTICATION: ["authentication"],
};

const TEMPLATE_TYPE_CONFIG: Record<TemplateType, TemplateTypeConfig> = {
  custom: {
    label: "Custom",
    description: "Free-form template with optional header, footer, and buttons.",
    requiredComponents: ["BODY"],
    optionalComponents: ["HEADER", "FOOTER", "BUTTONS"],
    allowedButtonTypes: ["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE", "ORDER_DETAILS", "CATALOG", "MPM", "VOICE_CALL"],
    allowHeader: true,
    allowFooter: true,
    allowMediaHeader: true,
    allowLocationHeader: true,
  },
  form: {
    label: "Form",
    description: "Body plus Flow button.",
    requiredComponents: ["BODY", "BUTTONS"],
    allowedButtonTypes: ["FLOW"],
  },
  carousel: {
    label: "Carousel",
    description: "Body plus carousel cards.",
    requiredComponents: ["BODY", "CAROUSEL"],
    allowedButtonTypes: ["QUICK_REPLY", "URL", "PHONE_NUMBER", "ORDER_DETAILS", "CATALOG", "VOICE_CALL"],
    allowHeader: false,
    allowFooter: false,
  },
  limited_time_offer: {
    label: "Limited time offer",
    description: "Offer block plus body and buttons.",
    requiredComponents: ["BODY", "LIMITED_TIME_OFFER", "BUTTONS"],
    optionalComponents: ["HEADER"],
    allowedButtonTypes: ["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE", "VOICE_CALL"],
    allowMediaHeader: true,
  },
  coupon_code: {
    label: "Coupon code",
    description: "Body plus copy-code button.",
    requiredComponents: ["BODY", "BUTTONS"],
    optionalComponents: ["HEADER"],
    allowedButtonTypes: ["COPY_CODE", "QUICK_REPLY", "URL", "PHONE_NUMBER"],
    allowMediaHeader: true,
  },
  catalog: {
    label: "Catalog",
    description: "Catalog or multi-product template.",
    requiredComponents: ["BODY", "BUTTONS"],
    allowedButtonTypes: ["CATALOG", "MPM", "ORDER_DETAILS", "QUICK_REPLY", "URL", "PHONE_NUMBER", "VOICE_CALL"],
  },
  voice_call: {
    label: "Voice call",
    description: "Body with voice-call action.",
    requiredComponents: ["BODY", "BUTTONS"],
    optionalComponents: ["HEADER"],
    allowedButtonTypes: ["VOICE_CALL", "QUICK_REPLY", "URL", "PHONE_NUMBER"],
    allowMediaHeader: true,
  },
  call_permission_request: {
    label: "Call permission request",
    description: "Header, body, footer, and call permission request block.",
    requiredComponents: ["HEADER", "BODY", "FOOTER", "CALL_PERMISSION_REQUEST"],
    allowHeader: true,
    allowFooter: true,
    allowMediaHeader: true,
  },
  order_status: {
    label: "Order status",
    description: "Body with optional footer and order status action.",
    requiredComponents: ["BODY"],
    optionalComponents: ["FOOTER", "BUTTONS"],
    allowedButtonTypes: ["ORDER_DETAILS"],
    allowFooter: true,
  },
  order_details: {
    label: "Order details",
    description: "Body with order details action.",
    requiredComponents: ["BODY", "BUTTONS"],
    optionalComponents: ["FOOTER"],
    allowedButtonTypes: ["ORDER_DETAILS"],
    allowFooter: true,
  },
  authentication: {
    label: "Authentication",
    description: "OTP verification template.",
    requiredComponents: ["AUTHENTICATION"],
    allowedButtonTypes: ["OTP"],
  },
};

const uid = () => `${Date.now()}-${Math.random()}`;

const createButton = (type: ButtonType = "QUICK_REPLY"): BuilderButton => ({
  id: uid(),
  type,
  text: "",
  url: "",
  phoneNumber: "",
  example: "",
  flowId: "",
  navigateScreen: "",
  flowAction: "",
  otpType: "COPY_CODE",
  payload: "",
  extraJson: "",
});

const createCard = (): CarouselCard => ({
  id: uid(),
  headerType: "IMAGE",
  headerText: "",
  mediaHandle: "",
  bodyText: "",
  buttons: [createButton("QUICK_REPLY")],
});

const createHeader = (): BuilderComponent => ({
  id: uid(),
  type: "HEADER",
  format: "TEXT",
  text: "",
  exampleText: "",
  mediaHandle: "",
  location: { latitude: "", longitude: "", name: "", address: "" },
});

const createBody = (): BuilderComponent => ({ id: uid(), type: "BODY", text: "", exampleText: "" });
const createFooter = (): BuilderComponent => ({ id: uid(), type: "FOOTER", text: "" });
const createButtons = (): BuilderComponent => ({ id: uid(), type: "BUTTONS", buttons: [createButton("QUICK_REPLY")] });
const createCarousel = (): BuilderComponent => ({ id: uid(), type: "CAROUSEL", cards: [createCard()] });
const createLimitedOffer = (): BuilderComponent => ({ id: uid(), type: "LIMITED_TIME_OFFER", text: "", hasExpiration: true, expirationTimeMs: "" });
const createAuthentication = (): BuilderComponent => ({
  id: uid(),
  type: "AUTHENTICATION",
  bodyText: "",
  securityRecommendation: true,
  codeExpirationMinutes: "10",
  buttonText: "Copy code",
});
const createCallPermissionRequest = (): BuilderComponent => ({ id: uid(), type: "CALL_PERMISSION_REQUEST" });

const createButtonsForTemplateType = (templateType: TemplateType): BuilderComponent => {
  switch (templateType) {
    case "form":
      return { ...createButtons(), buttons: [createButton("FLOW")] } as BuilderComponent;
    case "limited_time_offer":
    case "coupon_code":
      return { ...createButtons(), buttons: [createButton("COPY_CODE")] } as BuilderComponent;
    case "catalog":
      return { ...createButtons(), buttons: [createButton("CATALOG")] } as BuilderComponent;
    case "voice_call":
      return { ...createButtons(), buttons: [createButton("VOICE_CALL")] } as BuilderComponent;
    case "order_status":
    case "order_details":
      return { ...createButtons(), buttons: [createButton("ORDER_DETAILS")] } as BuilderComponent;
    case "authentication":
      return { ...createButtons(), buttons: [createButton("OTP")] } as BuilderComponent;
    case "custom":
    default:
      return createButtons();
  }
};

const createComponentsForTemplateType = (templateType: TemplateType): BuilderComponent[] => {
  switch (templateType) {
    case "form":
      return [createBody(), createButtonsForTemplateType("form")];
    case "carousel":
      return [createBody(), createCarousel()];
    case "limited_time_offer":
      return [createBody(), createLimitedOffer(), createButtonsForTemplateType("limited_time_offer")];
    case "coupon_code":
      return [createBody(), createButtonsForTemplateType("coupon_code")];
    case "catalog":
      return [createBody(), createButtonsForTemplateType("catalog")];
    case "voice_call":
      return [createBody(), createButtonsForTemplateType("voice_call")];
    case "call_permission_request":
      return [createHeader(), createBody(), createFooter(), createCallPermissionRequest()];
    case "order_status":
      return [createBody()];
    case "order_details":
      return [createBody(), createButtonsForTemplateType("order_details")];
    case "authentication":
      return [createAuthentication()];
    case "custom":
    default:
      return [createBody()];
  }
};

const createDraft = (): BuilderState => ({
  name: "whatsapp_template",
  language: "en",
  category: "MARKETING",
  templateType: "custom",
  subCategory: "",
  messageSendTtlSeconds: "86400",
  components: createComponentsForTemplateType("custom"),
});

function countVariables(text: string) {
  return (String(text || "").match(/\{\{\s*\d+\s*\}\}/g) || []).length;
}

function parseBodyExampleValues(exampleText: string) {
  return String(exampleText || "")
    .split(/\r?\n|\s*,\s*|\s*\|\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function replaceVariables(text: string, sampleValues: Record<string, string>) {
  return String(text || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index) => sampleValues[index] || `{{${index}}}`);
}

function isVariablesText(text: string) {
  return /\{\{\s*\d+\s*\}\}/.test(String(text || ""));
}

function getActiveComponent(draft: BuilderState, type: ComponentType) {
  return draft.components.find((component) => component.type === type) || null;
}

function resolveAllowedButtonTypes(draft: BuilderState) {
  return TEMPLATE_TYPE_CONFIG[draft.templateType].allowedButtonTypes || ["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE", "OTP", "ORDER_DETAILS", "CATALOG", "MPM", "VOICE_CALL"];
}

function isFlowBasedTemplate(draft: BuilderState) {
  return draft.templateType === "form";
}

function extractVariables(text: string): number[] {
  const matches = String(text || "").match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return matches.map((match) => Number(match.replace(/[^\d]/g, "")));
}

function validateVariables(text: string, values: string[]) {
  const vars = extractVariables(text);
  if (vars.length && (!values || values.length !== vars.length)) {
    throw new Error(`Variable count mismatch. Expected ${vars.length} values`);
  }
}

function buildBodyExample(values: string[]) {
  return values.length ? { body_text: [values] } : undefined;
}

function buildHeader(component: any) {
  const header: any = {
    type: "HEADER",
    format: component.format,
  };

  if (component.format === "TEXT") {
    header.text = component.text;

    const vars = extractVariables(component.text);
    if (vars.length) {
      if (!component.exampleText) {
        throw new Error("Header variables require example values");
      }
      header.example = {
        header_text: [component.exampleText],
      };
    }
  }

  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format)) {
    if (!component.mediaHandle) {
      throw new Error("Media header requires mediaHandle");
    }
    header.example = {
      header_handle: [component.mediaHandle],
    };
  }

  if (component.format === "LOCATION") {
    if (!component.location?.latitude || !component.location?.longitude || !component.location?.name || !component.location?.address) {
      throw new Error("Location header requires latitude, longitude, name and address");
    }
    header.location = {
      latitude: component.location.latitude,
      longitude: component.location.longitude,
      name: component.location.name,
      address: component.location.address,
    };
  }

  return header;
}

function buildBody(component: any) {
  const body: any = {
    type: "BODY",
    text: component.text,
  };

  const vars = extractVariables(component.text);
  if (vars.length) {
    const values = parseBodyExampleValues(component.exampleText);
    validateVariables(component.text, values);
    body.example = buildBodyExample(values);
  }
  return body;
}

function buildButtons(component: any) {
  if (!component.buttons?.length) return null;

  return {
    type: "BUTTONS",
    buttons: component.buttons.map((btn: any) => {
      const base: any = { type: btn.type };

      switch (btn.type) {
        case "QUICK_REPLY":
          if (!btn.text) throw new Error("QUICK_REPLY requires text");
          base.text = btn.text;
          break;

        case "URL":
          if (!btn.text || !btn.url) throw new Error("URL button requires text + url");
          base.text = btn.text;
          base.url = btn.url;
          if (btn.example) base.example = [btn.example];
          break;

        case "PHONE_NUMBER":
          if (!btn.text || !btn.phoneNumber) throw new Error("PHONE_NUMBER requires text + phoneNumber");
          base.text = btn.text;
          base.phone_number = btn.phoneNumber;
          break;

        case "COPY_CODE":
          if (!btn.example) throw new Error("COPY_CODE requires example value");
          base.example = btn.example;
          break;

        case "OTP":
          base.otp_type = btn.otpType || "COPY_CODE";
          base.text = btn.text || "Copy code";
          break;

        case "FLOW":
          if (!btn.flowId) throw new Error("FLOW button requires flow_id");
          base.text = btn.text;
          base.flow_id = btn.flowId;
          base.navigate_screen = btn.navigateScreen;
          base.flow_action = btn.flowAction;
          break;

        case "ORDER_DETAILS":
        case "CATALOG":
        case "MPM":
        case "VOICE_CALL":
          base.text = btn.text;
          break;

        default:
          throw new Error(`Unsupported button type: ${btn.type}`);
      }

      return base;
    }),
  };
}

function buildCarousel(component: any) {
  return {
    type: "CAROUSEL",
    cards: component.cards.map((card: any) => ({
      components: [
        {
          type: "HEADER",
          format: card.headerType,
          ...(card.headerType === "TEXT"
            ? {
                text: card.headerText,
                example: { header_text: [card.headerText || "Sample"] },
              }
            : {
                example: { header_handle: [card.mediaHandle] },
              }),
        },
        {
          type: "BODY",
          text: card.bodyText,
        },
        buildButtons({ buttons: card.buttons }),
      ].filter(Boolean),
    })),
  };
}

function buildLimitedTimeOffer(component: any) {
  return {
    type: "LIMITED_TIME_OFFER",
    limited_time_offer: {
      text: component.text,
      has_expiration: component.hasExpiration,
      ...(component.expirationTimeMs && {
        expiration_time_ms: Number(component.expirationTimeMs),
      }),
    },
  };
}

function payloadFromDraft(draft: BuilderState): WhatsAppTemplatePayload {
  const components: any[] = [];

  for (const comp of draft.components) {
    if (comp.type === "HEADER") {
      components.push(buildHeader(comp));
    }
    if (comp.type === "BODY") {
      components.push(buildBody(comp));
    }
    if (comp.type === "FOOTER") {
      if (extractVariables(comp.text).length) {
        throw new Error("Footer cannot contain variables");
      }
      components.push({ type: "FOOTER", text: comp.text });
    }
    if (comp.type === "BUTTONS") {
      const btn = buildButtons(comp);
      if (btn) components.push(btn);
    }
    if (comp.type === "CAROUSEL") {
      components.push(buildCarousel(comp));
    }
    if (comp.type === "LIMITED_TIME_OFFER") {
      components.push(buildLimitedTimeOffer(comp));
    }
    if (comp.type === "CALL_PERMISSION_REQUEST") {
      components.push({ type: "CALL_PERMISSION_REQUEST" });
    }
    if (comp.type === "AUTHENTICATION") {
      components.push({ type: "BODY", add_security_recommendation: comp.securityRecommendation });
      if (comp.codeExpirationMinutes.trim()) {
        components.push({ type: "FOOTER", code_expiration_minutes: Number(comp.codeExpirationMinutes || 0) });
      }
      components.push({
        type: "BUTTONS",
        buttons: [
          { type: "OTP", otp_type: "COPY_CODE", text: comp.buttonText || "Copy code" },
        ],
      });
    }
    if (comp.type === "CUSTOM") {
      if (comp.json.trim()) {
        try {
          const parsed = JSON.parse(comp.json);
          components.push({
            type: comp.componentType.trim() || String(parsed?.type || "CUSTOM"),
            ...(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}),
          });
        } catch {
          components.push({ type: comp.componentType.trim() || "CUSTOM" });
        }
      } else {
        components.push({ type: comp.componentType.trim() || "CUSTOM" });
      }
    }
  }

  const payload: any = {
    name: draft.name,
    language: draft.language,
    category: draft.category,
    components,
  };

  const resolvedSubCategory = draft.templateType === "order_status"
    ? "ORDER_STATUS"
    : (draft.templateType === "order_details" ? "ORDER_DETAILS" : "");

  if (resolvedSubCategory) {
    payload.sub_category = resolvedSubCategory;
  }

  if (draft.category === "MARKETING" && draft.messageSendTtlSeconds) {
    payload.message_send_ttl_seconds = Number(draft.messageSendTtlSeconds);
  }

  return payload;
}

function validateDraft(draft: BuilderState) {
  const allowedButtons = resolveAllowedButtonTypes(draft);
  if (!draft.name.trim()) return "Template name is required";
  if (!draft.language.trim()) return "Language is required";
  if (!draft.components.length) return "Add at least one component";
  if (!TEMPLATE_TYPE_OPTIONS[draft.category].includes(draft.templateType)) return "Template type is not valid for the selected category";

  const headers = draft.components.filter((component) => component.type === "HEADER");
  const bodies = draft.components.filter((component) => component.type === "BODY");
  const footers = draft.components.filter((component) => component.type === "FOOTER");
  const buttonBlocks = draft.components.filter((component) => component.type === "BUTTONS");
  const authComponents = draft.components.filter((component) => component.type === "AUTHENTICATION");
  const carouselComponents = draft.components.filter((component) => component.type === "CAROUSEL");

  if (headers.length > 1) return "Only one header is allowed";
  if (footers.length > 1) return "Only one footer is allowed";
  if (buttonBlocks.length > 1) return "Only one buttons block is allowed";
  if (!["MARKETING", "AUTHENTICATION"].includes(draft.category) && draft.messageSendTtlSeconds.trim()) return "TTL seconds can only be used for MARKETING and AUTHENTICATION templates";
  if (carouselComponents.length > 1) return "Only one carousel block is allowed";
  if (carouselComponents.length && draft.templateType !== "carousel") return "Carousel is only allowed for carousel templates";
  
  if (draft.templateType === "authentication") {
    if (!authComponents.length) return "Authentication templates require an AUTHENTICATION component";
  } else if (!bodies.length) {
    return "Body is required";
  }

  const quickReplies = buttonBlocks.flatMap((component) => component.buttons.filter((button) => button.type === "QUICK_REPLY"));
  const urls = buttonBlocks.flatMap((component) => component.buttons.filter((button) => button.type === "URL"));

  if (quickReplies.length > 3) return "Maximum 3 quick reply buttons are allowed";
  if (urls.length > 1) return "Maximum 1 URL button is allowed";

  if (draft.templateType === "form" && buttonBlocks.length && buttonBlocks.some((component) => component.buttons.some((button) => button.type !== "FLOW"))) {
    return "Form templates only support FLOW buttons";
  }

  for (const component of draft.components) {
    if (component.type === "HEADER" && component.format === "TEXT" && !component.text.trim()) {
      return "Header text is required for text headers";
    }
    if (component.type === "HEADER" && component.format !== "TEXT" && component.format !== "LOCATION" && !component.mediaHandle.trim()) {
      return "Header media handle is required for media headers";
    }
    if (component.type === "HEADER" && component.format === "LOCATION") {
      const { latitude, longitude, name, address } = component.location;
      if (!latitude || !longitude || !name.trim() || !address.trim()) return "Location header requires latitude, longitude, name and address";
    }
    if (component.type === "BODY") {
      const vars = countVariables(component.text);
      if (vars > 0 && !component.exampleText.trim()) return "Body example values are required when variables exist";
      if (vars > 1 && parseBodyExampleValues(component.exampleText).length !== vars) return `Body example must include exactly ${vars} values separated by commas`;
    }
    if (component.type === "FOOTER" && countVariables(component.text) > 0) return "Footer cannot contain variables";
    if (component.type === "BUTTONS") {
      const invalidButton = component.buttons.find((button) => !allowedButtons.includes(button.type));
      if (invalidButton) return "Button type is not allowed for this template type";
      if (draft.templateType === "form" && !component.buttons.some((button) => button.type === "FLOW")) return "Form templates require a FLOW button";
      if (draft.templateType === "order_details" && !component.buttons.some((button) => button.type === "ORDER_DETAILS")) return "Order details templates require an ORDER_DETAILS button";
      if (draft.templateType === "catalog" && !component.buttons.some((button) => button.type === "CATALOG" || button.type === "MPM")) return "Catalog templates require a CATALOG or MPM button";
      if (draft.templateType === "voice_call" && !component.buttons.some((button) => button.type === "VOICE_CALL")) return "Voice call templates require a VOICE_CALL button";
      if (draft.templateType === "coupon_code" && !component.buttons.some((button) => button.type === "COPY_CODE")) return "Coupon code templates require a COPY_CODE button";
      for (const button of component.buttons) {
        if ((button.type === "QUICK_REPLY" || button.type === "VOICE_CALL" || button.type === "ORDER_DETAILS" || button.type === "CATALOG" || button.type === "MPM") && !button.text.trim()) {
          return "Button text is required";
        }
        if (button.type === "URL" && (!button.text.trim() || !button.url.trim())) return "URL button requires text and URL";
        if (button.type === "PHONE_NUMBER" && (!button.text.trim() || !button.phoneNumber.trim())) return "Phone button requires text and phone number";
        if (button.type === "FLOW" && (!button.text.trim() || !button.flowId.trim())) return "Flow button requires text and flow ID";
        if (button.type === "COPY_CODE" && !button.example.trim()) return "Copy code button requires an example code";
      }
    }
    if (component.type === "AUTHENTICATION" && !component.buttonText.trim()) return "Authentication button text is required";
  }

  return "";
}

function statusLabel(status?: WhatsAppTemplateStatus | string | null) {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED") return "APPROVED";
  if (value === "REJECTED") return "REJECTED";
  if (value === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function inferTemplateTypeFromPayload(payload: any, category: WhatsAppTemplateCategory): TemplateType {
  const components = Array.isArray(payload?.components) ? payload.components : [];
  const hasType = (type: string) => components.some((component: any) => String(component?.type || "").toUpperCase() === type.toUpperCase());
  const hasButton = (buttonType: string) =>
    components.some((component: any) => String(component?.type || "").toUpperCase() === "BUTTONS" && Array.isArray((component as any).buttons) && (component as any).buttons?.some((button: any) => String(button?.type || "").toUpperCase() === buttonType.toUpperCase()));

  if (category === "AUTHENTICATION" || hasType("AUTHENTICATION") || hasButton("OTP")) return "authentication";
  if (hasType("CAROUSEL")) return "carousel";
  if (hasType("LIMITED_TIME_OFFER")) return "limited_time_offer";
  if (hasType("CALL_PERMISSION_REQUEST")) return "call_permission_request";
  if (hasButton("FLOW")) return "form";
  if (hasButton("COPY_CODE")) return "coupon_code";
  if (hasButton("CATALOG") || hasButton("MPM")) return "catalog";
  if (hasButton("VOICE_CALL")) return "voice_call";
  if (category === "UTILITY" && String(payload?.sub_category || "").toUpperCase() === "ORDER_STATUS") return "order_status";
  if (category === "UTILITY" && String(payload?.sub_category || "").toUpperCase() === "ORDER_DETAILS") return "order_details";
  return "custom";
}

function createTemplateFromRecord(record: WhatsAppTemplateRecord): BuilderState {
  const builderState = record.builderState as BuilderState | null | undefined;
  if (builderState && Array.isArray(builderState.components)) {
    return {
      ...builderState,
      templateType: builderState.templateType || inferTemplateTypeFromPayload(record.payload, record.category),
      components: builderState.components.map((component) => ({ ...component, id: uid() })) as BuilderComponent[],
    };
  }

  const payload = record.payload;
  const components = Array.isArray(payload?.components) ? payload.components : [];
  const draft = createDraft();
  draft.name = record.name;
  draft.language = record.language;
  draft.category = record.category;
  draft.templateType = inferTemplateTypeFromPayload(payload, record.category);
  draft.subCategory = record.subCategory || "";
  draft.messageSendTtlSeconds = String(record.messageSendTtlSeconds || payload?.message_send_ttl_seconds || "");
  draft.components = [];

  components.forEach((component: any) => {
    if (component.type === "HEADER") {
      const example = component.example as any;
      const location = component.location as any;
      draft.components.push({
        id: uid(),
        type: "HEADER",
        format: String(component.format || "TEXT") as HeaderFormat,
        text: String(component.text || ""),
        exampleText: String(example?.header_text?.[0] || ""),
        mediaHandle: String(component.media_handle || example?.header_handle?.[0] || ""),
        location: {
          latitude: String(location?.latitude || ""),
          longitude: String(location?.longitude || ""),
          name: String(location?.name || ""),
          address: String(location?.address || ""),
        },
      });
    } else if (component.type === "BODY") {
      const example = component.example as any;
      const bodyExampleValues = Array.isArray(example?.body_text)
        ? (Array.isArray(example.body_text[0]) ? (example.body_text[0] as string[]) : (example.body_text as string[]))
        : [];
      draft.components.push({
        id: uid(),
        type: "BODY",
        text: String(component.text || ""),
        exampleText: bodyExampleValues.join(", "),
      });
    } else if (component.type === "FOOTER") {
      draft.components.push({ id: uid(), type: "FOOTER", text: String(component.text || "") });
    } else if (component.type === "BUTTONS") {
      draft.components.push({
        id: uid(),
        type: "BUTTONS",
        buttons: (Array.isArray(component.buttons) ? component.buttons : []).map((button: any) => ({
          id: uid(),
          type: String(button.type || "QUICK_REPLY") as ButtonType,
          text: String(button.text || ""),
          url: String(button.url || ""),
          phoneNumber: String(button.phone_number || ""),
          example: Array.isArray(button.example) ? String(button.example[0] || "") : String(button.example || ""),
          flowId: String(button.flow_id || ""),
          navigateScreen: String(button.navigate_screen || ""),
          flowAction: String(button.flow_action || ""),
          otpType: String(button.otp_type || "COPY_CODE"),
          payload: String(button.payload || ""),
          extraJson: "",
        })),
      });
    } else if (component.type === "LIMITED_TIME_OFFER") {
      const offer = component.limited_time_offer as any;
      draft.components.push({
        id: uid(),
        type: "LIMITED_TIME_OFFER",
        text: String(offer?.text || ""),
        hasExpiration: Boolean(offer?.has_expiration),
        expirationTimeMs: String(offer?.expiration_time_ms || ""),
      });
    } else if (component.type === "CALL_PERMISSION_REQUEST") {
      draft.components.push({ id: uid(), type: "CALL_PERMISSION_REQUEST" });
    } else {
      draft.components.push({
        id: uid(),
        type: "CUSTOM",
        componentType: String(component.type || "CUSTOM"),
        json: JSON.stringify(component, null, 2),
      });
    }
  });

  if (!draft.components.length) draft.components = [createBody()];
  return draft;
}

const SAMPLE_VALUES: Record<string, string> = {
  1: "John",
  2: "order #99281",
  3: "$149.00",
  4: "https://modernorthodontics.com",
};

/* Local Simple Forms Elements for styling */
function LocalInput({ label, value, onChange, placeholder, type = "text", hint, disabled }: any) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && <label className="text-[10px] font-bold text-[#7A7A7A] uppercase tracking-wider">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="border border-[#E6E6E6] rounded px-3 py-2 text-[13px] text-[#1A1A1A] bg-white outline-none focus:border-[#E31E24] disabled:bg-[#F9F9F9] transition-all"
      />
      {hint && <span className="text-[9px] text-[#7A7A7A] mt-0.5">{hint}</span>}
    </div>
  );
}

function LocalSelect({ label, value, onChange, children, hint, disabled }: any) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && <label className="text-[10px] font-bold text-[#7A7A7A] uppercase tracking-wider">{label}</label>}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="border border-[#E6E6E6] rounded px-3 py-2 text-[13px] text-[#1A1A1A] bg-white outline-none focus:border-[#E31E24] disabled:bg-[#F9F9F9] transition-all"
      >
        {children}
      </select>
      {hint && <span className="text-[9px] text-[#7A7A7A] mt-0.5">{hint}</span>}
    </div>
  );
}

function LocalTextarea({ label, value, onChange, placeholder, rows = 3, hint, disabled }: any) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && <label className="text-[10px] font-bold text-[#7A7A7A] uppercase tracking-wider">{label}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="border border-[#E6E6E6] rounded px-3 py-2 text-[13px] text-[#1A1A1A] bg-white outline-none focus:border-[#E31E24] disabled:bg-[#F9F9F9] transition-all resize-y"
      />
      {hint && <span className="text-[9px] text-[#7A7A7A] mt-0.5">{hint}</span>}
    </div>
  );
}

export default function WhatsAppTemplatesPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | WhatsAppTemplateStatus>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | WhatsAppTemplateCategory>("all");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<BuilderState>(createDraft());
  const [mode, setMode] = useState<"library" | "builder">("library");
  const [viewSource, setViewSource] = useState<"form" | "preview">("form");
  const [testRecipient, setTestRecipient] = useState("");
  const [testResponse, setTestResponse] = useState<any>(null);
  const [syncRemote, setSyncRemote] = useState("false");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const { data: templates = [], isLoading, refetch } = useWhatsAppTemplates({
    search: search.trim() || undefined,
    category: filterCategory !== "all" ? filterCategory : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    syncRemote,
  });

  const createMutation = useCreateWhatsAppTemplate();
  const updateMutation = useUpdateWhatsAppTemplate();
  const deleteMutation = useDeleteWhatsAppTemplate();
  const refreshMutation = useRefreshWhatsAppTemplateStatus();
  const testSendMutation = useSendTestWhatsAppTemplate();

  const selectedTemplate = templates.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (selectedTemplate) {
      setDraft(createTemplateFromRecord(selectedTemplate));
      setTestResponse(null);
      setMode("builder");
    }
  }, [selectedId, templates]);

  const validationError = useMemo(() => validateDraft(draft), [draft]);
  const payloadResult = useMemo(() => {
    try {
      return {
        payload: payloadFromDraft(draft),
        error: "",
      };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error ? error.message : "Unable to compile template payload",
      };
    }
  }, [draft]);

  const payload = payloadResult.payload;
  const payloadError = payloadResult.error;
  const editorError = validationError || payloadError;

  const templateTypeConfig = TEMPLATE_TYPE_CONFIG[draft.templateType];
  const templateTypeOptions = TEMPLATE_TYPE_OPTIONS[draft.category];

  const applyTemplateType = (templateType: TemplateType, preserveBase = true) => {
    setDraft((current) => ({
      ...current,
      templateType,
      subCategory: templateType === "order_status"
        ? "ORDER_STATUS"
        : (templateType === "order_details" ? "ORDER_DETAILS" : ""),
      components: preserveBase ? createComponentsForTemplateType(templateType) : current.components,
    }));
  };

  const applyCategory = (category: WhatsAppTemplateCategory) => {
    setDraft((current) => {
      const allowedTypes = TEMPLATE_TYPE_OPTIONS[category];
      const templateType = allowedTypes.includes(current.templateType) ? current.templateType : allowedTypes[0];
      return {
        ...current,
        category,
        templateType,
        subCategory: category === "UTILITY" ? current.subCategory : "",
        messageSendTtlSeconds: category === "MARKETING"
          ? (current.messageSendTtlSeconds || "86400")
          : (category === "AUTHENTICATION" ? current.messageSendTtlSeconds : ""),
        components: createComponentsForTemplateType(templateType),
      };
    });
  };

  const toggleOptionalComponent = (componentType: "HEADER" | "FOOTER" | "BUTTONS") => {
    setDraft((current) => {
      const exists = current.components.some((component) => component.type === componentType);
      if (exists) {
        return { ...current, components: current.components.filter((component) => component.type !== componentType) };
      }
      const next = [...current.components];
      if (componentType === "HEADER") next.unshift(createHeader());
      if (componentType === "FOOTER") next.push(createFooter());
      if (componentType === "BUTTONS") next.push(createButtonsForTemplateType(current.templateType));
      return { ...current, components: next };
    });
  };

  const getComponentByType = (type: ComponentType) => draft.components.find((component) => component.type === type) || null;

  const insertNextBodyVariable = () => {
    const body = getComponentByType("BODY");
    if (!body || body.type !== "BODY") return;
    const nextIndex = countVariables(body.text) + 1;
    const token = `{{${nextIndex}}}`;
    const nextText = body.text.trim() ? `${body.text} ${token}` : token;
    updateComponent(body.id, { text: nextText });
  };

  const applySample = () => {
    const next = createDraft();
    next.templateType = "custom";
    next.components = [
      {
        id: uid(),
        type: "HEADER",
        format: "TEXT",
        text: "Hello {{1}}!",
        exampleText: "John Doe",
        mediaHandle: "",
        location: { latitude: "", longitude: "", name: "", address: "" },
      },
      {
        id: uid(),
        type: "BODY",
        text: "Your order {{2}} has been confirmed. The total is {{3}}.",
        exampleText: "order #99281, $149.00",
      },
      {
        id: uid(),
        type: "BUTTONS",
        buttons: [
          {
            id: uid(),
            type: "URL",
            text: "View Order Details",
            url: "https://modernorthodontics.com/orders/{{1}}",
            phoneNumber: "",
            example: "99281",
            flowId: "",
            navigateScreen: "",
            flowAction: "",
            otpType: "COPY_CODE",
            payload: "",
            extraJson: "",
          },
        ],
      },
      createFooter(),
    ];
    setDraft(next);
    setMode("builder");
    setViewSource("form");
    setSelectedId("");
    showNotification("success", "Sample template configurations loaded!");
  };

  const updateComponent = (id: string, patch: Partial<BuilderComponent>) => {
    setDraft((current) => ({
      ...current,
      components: current.components.map((component) => (component.id === id ? ({ ...component, ...patch } as BuilderComponent) : component)),
    }));
  };

  const saveTemplate = async () => {
    if (editorError) {
      showNotification("error", editorError);
      return;
    }
    if (!payload) {
      showNotification("error", "Payload configuration is not compiled yet.");
      return;
    }

    try {
      if (selectedId) {
        await updateMutation.mutateAsync({
          id: selectedId,
          payload: payload as WhatsAppTemplatePayload,
          builder: draft,
        });
        showNotification("success", "Template updated successfully.");
      } else {
        const created = await createMutation.mutateAsync({
          payload: payload as WhatsAppTemplatePayload,
          builder: draft,
        });
        if (created) {
          setSelectedId(created.id);
        }
        showNotification("success", "New template created successfully.");
      }
      refetch();
    } catch (e: any) {
      showNotification("error", e.response?.data?.message || e.message || "Failed to save template.");
    }
  };

  const deleteTemplate = async () => {
    if (!selectedId) return;
    if (!window.confirm("Are you sure you want to delete this template from local database and the provider?")) return;

    try {
      await deleteMutation.mutateAsync(selectedId);
      showNotification("success", "Template deleted successfully.");
      setSelectedId("");
      setDraft(createDraft());
      setMode("library");
      refetch();
    } catch (e: any) {
      showNotification("error", e.response?.data?.message || e.message || "Failed to delete template.");
    }
  };

  const refreshStatus = async (id: string) => {
    try {
      const refreshed = await refreshMutation.mutateAsync(id);
      showNotification("success", `Sync completed. Status: ${refreshed.status}`);
      refetch();
    } catch (e: any) {
      showNotification("error", e.response?.data?.message || e.message || "Failed to sync status.");
    }
  };

  const sendTest = async () => {
    if (!selectedId) {
      showNotification("error", "Save the template first before running a test send.");
      return;
    }
    if (!testRecipient.trim()) {
      showNotification("error", "Please provide a valid recipient mobile number (+91...)");
      return;
    }

    try {
      const result = await testSendMutation.mutateAsync({
        id: selectedId,
        payload: { to: testRecipient.trim() },
      });
      setTestResponse(result);
      showNotification("success", "Test template dispatched successfully!");
    } catch (e: any) {
      showNotification("error", e.response?.data?.message || e.message || "Failed to dispatch test message.");
    }
  };

  const handleSyncFromTata = async () => {
    try {
      setSyncRemote("true");
      showNotification("success", "Syncing all templates from Tata gateway...");
      setTimeout(async () => {
        await refetch();
        setSyncRemote("false");
        showNotification("success", "Prisma Database updated with Tata remote records.");
      }, 200);
    } catch (e: any) {
      setSyncRemote("false");
      showNotification("error", "Failed to sync remote records.");
    }
  };

  return (
    <AdminLayout title="WhatsApp Template Builder">
      <div className="wa-builder-root flex flex-col p-6 min-h-screen bg-[#F9F9F9] text-[#1A1A1A] font-sans">
        
        {/* Page title and description matching reference */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">WhatsApp Template Builder</h1>
          <p className="text-[13px] text-[#6B6B6B] mt-1">Build Tata WhatsApp templates dynamically, preview them live, and keep a separate list of saved template records.</p>
        </div>

        {/* Floating notifications */}
        {notification && (
          <div className={`fixed top-20 right-6 z-[9999] px-4 py-3 rounded shadow-lg border text-[13px] font-bold flex items-center gap-2 animate-bounce ${
            notification.type === "success" ? "bg-[#EEF7F2] border-[#2E7D52] text-[#2E7D52]" : "bg-[#FDEDEC] border-[#C0392B] text-[#C0392B]"
          }`}>
            <span>{notification.message}</span>
          </div>
        )}

        <div className="wa-template-shell mt-2">
          
          <div className="wa-template-layout">
            
            {/* Template Library Panel (Left Side) */}
            <section className="wa-template-list-panel border border-[#E6E6E6] rounded-lg shadow-sm">
              <div className="wa-template-list-head flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-[15px] text-[#1A1A1A]">Template Library</h3>
                  <p>Saved records are stored separately from normal media and can be reopened for editing or test sends.</p>
                </div>
                <div className="wa-template-search w-full border border-[#E6E6E6] rounded px-3">
                  <Search size={15} className="text-[#7A7A7A]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, status, language..." className="text-[13px] text-[#1A1A1A] ml-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <LocalSelect label="Category" value={filterCategory} onChange={(e: any) => setFilterCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </LocalSelect>
                <LocalSelect label="Status" value={filterStatus} onChange={(e: any) => setFilterStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="UNKNOWN">Unknown</option>
                </LocalSelect>
              </div>

              {/* Action Buttons in Left Panel */}
              <div className="wa-template-list-actions mt-3">
                <button
                  onClick={() => { setSyncRemote("false"); setTimeout(() => refetch(), 50); }}
                  className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition flex items-center gap-1.5 bg-white uppercase tracking-wider"
                >
                  <RefreshCw size={13} /> Refresh List
                </button>
                <button
                  onClick={handleSyncFromTata}
                  className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition flex items-center gap-1.5 bg-white uppercase tracking-wider"
                >
                  <Upload size={13} className="rotate-180" /> Sync From Tata
                </button>
              </div>

              <div className="wa-template-list mt-4 max-h-[500px] overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="text-center py-8 text-[13px] text-[#7A7A7A]">Loading templates...</div>
                ) : templates.map((template: any) => (
                  <button
                    type="button"
                    key={template.id}
                    className={`wa-template-row border border-[#E6E6E6] rounded ${selectedId === template.id ? "active border-[#E31E24] ring-1 ring-[#E31E24]" : ""}`}
                    onClick={() => { setSelectedId(template.id); setMode("builder"); }}
                  >
                    <div className="wa-template-row-main text-left">
                      <strong>{template.name}</strong>
                      <span>{template.category} • {template.language}</span>
                    </div>
                    <div className={`wa-status-pill status-${String(template.status || "unknown").toLowerCase()}`}>{statusLabel(template.status)}</div>
                  </button>
                ))}
                {!isLoading && !templates.length && (
                  <div className="text-center py-8 text-[13px] text-[#7A7A7A] border border-dashed rounded">No templates found matching filters.</div>
                )}
              </div>
            </section>

            {/* Right side layout depending on mode */}
            {mode === "library" ? (
              /* Overview and Stats Mode (Screenshot 2) */
              <div className="flex flex-col gap-6">
                
                {/* Hero card block */}
                <div className="wa-template-hero rounded-lg shadow-sm border border-[#E6E6E6] bg-white p-6">
                  <div>
                    <div className="wa-template-kicker text-[10px] font-bold text-[#7A7A7A] uppercase tracking-widest mb-1">Template Viewer</div>
                    <h2 className="text-2xl text-[#1A1A1A] font-semibold mb-2">Browse WhatsApp templates, preview their content, and send test messages.</h2>
                    <p className="text-[13.5px] text-[#6B6B6B] leading-relaxed">Select a template from the library to view its components and send a test to any number.</p>
                  </div>
                  <div className="wa-template-hero-actions mt-4 flex gap-2">
                    <button onClick={applySample} className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-4 py-2 rounded font-bold text-[13px] transition bg-white flex items-center gap-1.5">
                      Load Sample
                    </button>
                    <button onClick={() => { setSelectedId(""); setDraft(createDraft()); setMode("builder"); }} className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-4 py-2 rounded font-bold text-[13px] transition flex items-center gap-1.5 shadow-sm">
                      <Plus size={14} /> Open Builder
                    </button>
                  </div>
                </div>

                {/* Stats cards in grid */}
                <div className="wa-template-stats rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="wa-stat-card border border-[#E6E6E6] rounded p-4 bg-white shadow-sm flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-[#7A7A7A] uppercase tracking-wider">Total Templates</span>
                    <strong className="text-3xl font-bold text-[#1A1A1A]">{templates.length}</strong>
                  </div>
                  <div className="wa-stat-card border border-[#E6E6E6] rounded p-4 bg-white shadow-sm flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-[#7A7A7A] uppercase tracking-wider">Saved Status</span>
                    <strong className="text-3xl font-bold text-[#1A1A1A]">{templates.length}</strong>
                  </div>
                  <div className="wa-stat-card border border-[#E6E6E6] rounded p-4 bg-white shadow-sm flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-[#7A7A7A] uppercase tracking-wider">Draft Components</span>
                    <strong className="text-3xl font-bold text-[#1A1A1A]">{draft.components.length}</strong>
                  </div>
                  <div className="wa-stat-card border border-[#E6E6E6] rounded p-4 bg-white shadow-sm flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-[#7A7A7A] uppercase tracking-wider">Selected</span>
                    <strong className="text-[15px] truncate font-bold text-[#1A1A1A] block mt-1">{selectedTemplate ? selectedTemplate.name : "None Selected"}</strong>
                  </div>
                </div>

              </div>
            ) : (
              /* Builder and Editor Mode (Screenshot 3 & 4) */
              <section className="wa-template-editor-panel border border-[#E6E6E6] rounded-lg shadow-sm bg-white p-6">
                
                <div className="wa-template-editor-head border-b border-[#E6E6E6] pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-[#1A1A1A]">{selectedId ? "View Template" : "Create Template"}</h3>
                    <p className="text-[13px] text-[#6B6B6B] mt-1">{selectedId ? "Read template content and send a test message to any number." : "Build Smartflo payloads with dynamic components and live WhatsApp preview."}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedId && (
                      <button
                        onClick={deleteTemplate}
                        className="border border-[#C0392B] text-[#C0392B] hover:bg-[#FDEDEC] px-3 py-1.5 rounded font-bold text-[12px] transition"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setMode("library")}
                      className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition bg-white"
                    >
                      Library View
                    </button>
                    <div className="wa-template-editor-toggle border rounded-full p-1 bg-[#F9F9F9] flex">
                      <button className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${viewSource === "form" ? "bg-white text-[#E31E24] shadow-sm" : "text-[#7A7A7A]"}`} onClick={() => setViewSource("form")}>Builder</button>
                      <button className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${viewSource === "preview" ? "bg-white text-[#E31E24] shadow-sm" : "text-[#7A7A7A]"}`} onClick={() => setViewSource("preview")}>Preview</button>
                    </div>
                  </div>
                </div>

                {viewSource === "form" ? (
                  <div className="flex flex-col gap-6 mt-4">
                    {/* Meta configurations */}
                    <div className="grid grid-cols-2 gap-4">
                      <LocalInput label="Name" value={draft.name} onChange={(e: any) => setDraft((current) => ({ ...current, name: e.target.value }))} hint="Must contain only lowercase letters, digits, and underscores." />
                      <LocalInput label="Language" value={draft.language} onChange={(e: any) => setDraft((current) => ({ ...current, language: e.target.value }))} hint="E.g. en, hi, or es" />
                      
                      <LocalSelect label="Category" value={draft.category} onChange={(e: any) => applyCategory(e.target.value as WhatsAppTemplateCategory)}>
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                      </LocalSelect>

                      <LocalSelect label="Template type" value={draft.templateType} onChange={(e: any) => applyTemplateType(e.target.value as TemplateType)}>
                        {templateTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>{TEMPLATE_TYPE_CONFIG[opt].label}</option>
                        ))}
                      </LocalSelect>

                      <LocalSelect label="Sub Category" value={draft.subCategory} disabled={draft.category !== "UTILITY"} onChange={(e: any) => setDraft((current) => ({ ...current, subCategory: e.target.value as any }))}>
                        <option value="">None</option>
                        <option value="ORDER_STATUS">ORDER_STATUS</option>
                        <option value="ORDER_DETAILS">ORDER_DETAILS</option>
                      </LocalSelect>

                      {["MARKETING", "AUTHENTICATION"].includes(draft.category) && (
                        <LocalInput label="TTL Seconds" value={draft.messageSendTtlSeconds} onChange={(e: any) => setDraft((current) => ({ ...current, messageSendTtlSeconds: e.target.value }))} placeholder={draft.category === "MARKETING" ? "86400" : "600"} />
                      )}
                    </div>

                    <div className="wa-template-type-card border border-[#E6E6E6] bg-[#FAFAFA] rounded p-4 text-left">
                      <strong className="text-[13px] text-[#1A1A1A] block">{templateTypeConfig.label}</strong>
                      <span className="text-[11px] text-[#7A7A7A] mt-1 block leading-relaxed">{templateTypeConfig.description}</span>
                    </div>

                    {/* Components toolbar */}
                    {templateTypeConfig.optionalComponents?.length ? (
                      <div className="wa-template-builder-toolbar flex gap-2 border-t border-[#E6E6E6] pt-4">
                        {templateTypeConfig.optionalComponents.includes("HEADER") && (
                          <button onClick={() => toggleOptionalComponent("HEADER")} className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition bg-white">
                            {getComponentByType("HEADER") ? "- Remove Header" : "+ Add Header"}
                          </button>
                        )}
                        {templateTypeConfig.optionalComponents.includes("FOOTER") && (
                          <button onClick={() => toggleOptionalComponent("FOOTER")} className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition bg-white">
                            {getComponentByType("FOOTER") ? "- Remove Footer" : "+ Add Footer"}
                          </button>
                        )}
                        {templateTypeConfig.optionalComponents.includes("BUTTONS") && (
                          <button onClick={() => toggleOptionalComponent("BUTTONS")} className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-3 py-1.5 rounded font-bold text-[12px] transition bg-white">
                            {getComponentByType("BUTTONS") ? "- Remove Buttons Block" : "+ Add Buttons Block"}
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* Dynamic Components editor */}
                    <div className="wa-component-list flex flex-col gap-4">
                      {draft.components.map((component) => {
                        const isOptional = templateTypeConfig.optionalComponents?.includes(component.type);
                        const canRemove = isOptional && draft.templateType === "custom";

                        if (component.type === "HEADER") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Header Block</h4>
                                {canRemove && <button onClick={() => toggleOptionalComponent("HEADER")} className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider transition">Remove</button>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <LocalSelect label="Format" value={component.format} onChange={(e: any) => updateComponent(component.id, { format: e.target.value as HeaderFormat })}>
                                  <option value="TEXT">TEXT</option>
                                  <option value="IMAGE">IMAGE</option>
                                  <option value="VIDEO">VIDEO</option>
                                  <option value="DOCUMENT">DOCUMENT</option>
                                  <option value="LOCATION">LOCATION</option>
                                </LocalSelect>
                                {component.format === "TEXT" && (
                                  <>
                                    <LocalInput label="Header Text" value={component.text} onChange={(e: any) => updateComponent(component.id, { text: e.target.value })} placeholder="E.g. Welcome {{1}}" />
                                    <LocalInput label="Variable Example" value={component.exampleText} onChange={(e: any) => updateComponent(component.id, { exampleText: e.target.value })} placeholder="E.g. John" />
                                  </>
                                )}
                                {["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format) && (
                                  <LocalInput label="Media Handle URL" value={component.mediaHandle} onChange={(e: any) => updateComponent(component.id, { mediaHandle: e.target.value })} placeholder="E.g. https://domain.com/asset.jpg" />
                                )}
                                {component.format === "LOCATION" && (
                                  <>
                                    <LocalInput label="Latitude" value={component.location.latitude} onChange={(e: any) => updateComponent(component.id, { location: { ...component.location, latitude: e.target.value } } as any)} />
                                    <LocalInput label="Longitude" value={component.location.longitude} onChange={(e: any) => updateComponent(component.id, { location: { ...component.location, longitude: e.target.value } } as any)} />
                                    <LocalInput label="Place name" value={component.location.name} onChange={(e: any) => updateComponent(component.id, { location: { ...component.location, name: e.target.value } } as any)} />
                                    <LocalInput label="Address" value={component.location.address} onChange={(e: any) => updateComponent(component.id, { location: { ...component.location, address: e.target.value } } as any)} />
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (component.type === "BODY") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Body Block</h4>
                                <button onClick={insertNextBodyVariable} className="text-[#E31E24] hover:text-[#C1171C] text-[11px] font-bold uppercase tracking-wider border border-[#E6E6E6] rounded px-2.5 py-1 bg-white transition">+ Insert Variable</button>
                              </div>
                              <LocalTextarea label="Body Text Content" value={component.text} rows={4} onChange={(e: any) => updateComponent(component.id, { text: e.target.value })} placeholder="E.g. Hello {{1}}, your order {{2}} has been confirmed." />
                              <LocalInput label="Example values" value={component.exampleText} onChange={(e: any) => updateComponent(component.id, { exampleText: e.target.value })} placeholder="E.g. John, 1024 (separate multiple variables with commas)" />
                            </div>
                          );
                        }

                        if (component.type === "FOOTER") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Footer Block</h4>
                                {canRemove && <button onClick={() => toggleOptionalComponent("FOOTER")} className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider transition">Remove</button>}
                              </div>
                              <LocalInput label="Footer text" value={component.text} onChange={(e: any) => updateComponent(component.id, { text: e.target.value })} placeholder="E.g. Reply STOP to opt out" />
                            </div>
                          );
                        }

                        if (component.type === "BUTTONS") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Buttons List</h4>
                                <div className="flex gap-2">
                                  <button onClick={() => updateComponent(component.id, { buttons: [...component.buttons, createButton(resolveAllowedButtonTypes(draft)[0])] } as any)} className="text-[#E31E24] hover:text-[#C1171C] text-[11px] font-bold uppercase tracking-wider border border-[#E6E6E6] rounded px-2.5 py-1 bg-white transition">+ Add Button</button>
                                  {canRemove && <button onClick={() => toggleOptionalComponent("BUTTONS")} className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider transition">Remove</button>}
                                </div>
                              </div>

                              <div className="flex flex-col gap-4">
                                {component.buttons.map((btn, index) => (
                                  <div key={btn.id} className="border border-[#E6E6E6] rounded p-3 bg-white flex flex-col gap-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-[#F5F5F5]">
                                      <span className="text-[11px] font-bold text-[#1A1A1A]">Button {index + 1}</span>
                                      <button onClick={() => updateComponent(component.id, { buttons: component.buttons.filter((b) => b.id !== btn.id) } as any)} className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase tracking-wider">Remove Button</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <LocalSelect label="Type" value={btn.type} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, type: e.target.value } : b) } as any)}>
                                        {resolveAllowedButtonTypes(draft).map((t) => (
                                          <option key={t} value={t}>{t}</option>
                                        ))}
                                      </LocalSelect>
                                      <LocalInput label="Button Label Text" value={btn.text} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, text: e.target.value } : b) } as any)} />
                                      
                                      {btn.type === "URL" && (
                                        <>
                                          <LocalInput label="Destination URL" value={btn.url} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, url: e.target.value } : b) } as any)} placeholder="https://domain.com/track/{{1}}" />
                                          <LocalInput label="URL Variable Sample" value={btn.example} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, example: e.target.value } : b) } as any)} placeholder="99182" />
                                        </>
                                      )}

                                      {btn.type === "PHONE_NUMBER" && (
                                        <LocalInput label="Phone Number" value={btn.phoneNumber} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, phoneNumber: e.target.value } : b) } as any)} placeholder="+919876543210" />
                                      )}

                                      {btn.type === "COPY_CODE" && (
                                        <LocalInput label="Sample coupon code" value={btn.example} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, example: e.target.value } : b) } as any)} placeholder="DISCOUNT10" />
                                      )}

                                      {btn.type === "FLOW" && (
                                        <>
                                          <LocalInput label="Flow ID" value={btn.flowId} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, flowId: e.target.value } : b) } as any)} placeholder="E.g. 1029199201" />
                                          <LocalInput label="Target Screen" value={btn.navigateScreen} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, navigateScreen: e.target.value } : b) } as any)} placeholder="Optional target screen key" />
                                          <LocalInput label="Flow Action" value={btn.flowAction} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, flowAction: e.target.value } : b) } as any)} placeholder="Optional action name" />
                                        </>
                                      )}
                                      
                                      <div className="col-span-2">
                                        <LocalTextarea label="Extra Params JSON" value={btn.extraJson} rows={2} onChange={(e: any) => updateComponent(component.id, { buttons: component.buttons.map((b) => b.id === btn.id ? { ...b, extraJson: e.target.value } : b) } as any)} placeholder='{"key": "value"}' />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (component.type === "LIMITED_TIME_OFFER") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Limited Time Offer Banner</h4>
                                <button onClick={() => updateComponent(component.id, { type: "BODY" } as any)} className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider transition">Remove</button>
                              </div>
                              <LocalInput label="Offer Text description" value={component.text} onChange={(e: any) => updateComponent(component.id, { text: e.target.value })} placeholder="E.g. 20% off Ortho braces ends tonight!" />
                              <div className="grid grid-cols-2 gap-3">
                                <LocalSelect label="Has Expiration" value={String(component.hasExpiration)} onChange={(e: any) => updateComponent(component.id, { hasExpiration: e.target.value === "true" })}>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </LocalSelect>
                                <LocalInput label="Expiration timestamp (ms)" value={component.expirationTimeMs} onChange={(e: any) => updateComponent(component.id, { expirationTimeMs: e.target.value })} placeholder="1813446744000" />
                              </div>
                            </div>
                          );
                        }

                        if (component.type === "CAROUSEL") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Carousel Cards</h4>
                                <button onClick={() => updateComponent(component.id, { cards: [...component.cards, createCard()] } as any)} className="text-[#E31E24] hover:text-[#C1171C] text-[11px] font-bold uppercase tracking-wider border border-[#E6E6E6] rounded px-2.5 py-1 bg-white transition">+ Add card</button>
                              </div>

                              <div className="flex flex-col gap-4">
                                {component.cards.map((card, idx) => (
                                  <div key={card.id} className="border border-[#E6E6E6] rounded p-3 bg-white flex flex-col gap-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-[#F5F5F5]">
                                      <span className="text-[11px] font-bold">Card {idx + 1}</span>
                                      <button onClick={() => updateComponent(component.id, { cards: component.cards.filter((c) => c.id !== card.id) } as any)} className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase tracking-wider">Remove Card</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <LocalSelect label="Header format" value={card.headerType} onChange={(e: any) => updateComponent(component.id, { cards: component.cards.map((c) => c.id === card.id ? { ...c, headerType: e.target.value } : c) } as any)}>
                                        <option value="TEXT">TEXT</option>
                                        <option value="IMAGE">IMAGE</option>
                                        <option value="VIDEO">VIDEO</option>
                                      </LocalSelect>
                                      {card.headerType === "TEXT" ? (
                                        <LocalInput label="Header text" value={card.headerText} onChange={(e: any) => updateComponent(component.id, { cards: component.cards.map((c) => c.id === card.id ? { ...c, headerText: e.target.value } : c) } as any)} />
                                      ) : (
                                        <LocalInput label="Media Handle URL" value={card.mediaHandle} onChange={(e: any) => updateComponent(component.id, { cards: component.cards.map((c) => c.id === card.id ? { ...c, mediaHandle: e.target.value } : c) } as any)} />
                                      )}
                                      <div className="col-span-2">
                                        <LocalTextarea label="Body text content" value={card.bodyText} rows={2} onChange={(e: any) => updateComponent(component.id, { cards: component.cards.map((c) => c.id === card.id ? { ...c, bodyText: e.target.value } : c) } as any)} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (component.type === "AUTHENTICATION") {
                          return (
                            <div key={component.id} className="wa-component-card border border-[#E6E6E6] rounded p-4 bg-[#FDFDFD]">
                              <div className="wa-component-head border-b border-[#E6E6E6] pb-2 mb-3">
                                <h4 className="font-bold text-[#E31E24]">Authentication OTP Block</h4>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <LocalSelect label="Security recommendations" value={String(component.securityRecommendation)} onChange={(e: any) => updateComponent(component.id, { securityRecommendation: e.target.value === "true" })}>
                                  <option value="true">Enabled (recommended)</option>
                                  <option value="false">Disabled</option>
                                </LocalSelect>
                                <LocalInput label="OTP expiration minutes" value={component.codeExpirationMinutes} onChange={(e: any) => updateComponent(component.id, { codeExpirationMinutes: e.target.value })} />
                                <LocalInput label="OTP Button label" value={component.buttonText} onChange={(e: any) => updateComponent(component.id, { buttonText: e.target.value })} />
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                ) : (
                  /* Live Preview Tab */
                  <div className="wa-preview-shell border border-[#E6E6E6] rounded-lg mt-4 bg-[#FBFBFB]">
                    {/* Phone simulator */}
                    <div className="wa-preview-phone shadow-lg">
                      <div className="wa-preview-header">
                        <span>WhatsApp Business</span>
                        <span className="text-[10px] text-[#A6C4BF] font-mono">LIVE PREVIEW</span>
                      </div>
                      <div className="wa-preview-chat">
                        {draft.components.map((component) => {
                          if (component.type === "HEADER") {
                            return (
                              <div key={component.id} className="wa-preview-bubble wa-preview-bubble-header border-[#E6E6E6]">
                                <strong className="text-[9px] uppercase tracking-wider text-[#E31E24]">{component.format} Header</strong>
                                {component.format === "TEXT" ? (
                                  <span className="font-semibold">{replaceVariables(component.text, SAMPLE_VALUES)}</span>
                                ) : (
                                  <div className="bg-[#F0F0F0] text-[11px] p-4 text-center rounded border text-[#7A7A7A]">
                                    Media File Preview ({component.mediaHandle ? "URL loaded" : "Empty handle"})
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (component.type === "BODY") {
                            return (
                              <div key={component.id} className="wa-preview-bubble border-[#E6E6E6]">
                                {replaceVariables(component.text, SAMPLE_VALUES)}
                              </div>
                            );
                          }
                          if (component.type === "FOOTER") {
                            return (
                              <div key={component.id} className="wa-preview-footer font-mono">
                                {component.text}
                              </div>
                            );
                          }
                          if (component.type === "LIMITED_TIME_OFFER") {
                            return (
                              <div key={component.id} className="wa-preview-bubble wa-preview-offer border-[#E31E24] bg-[#FFF8F5]">
                                {component.text}
                              </div>
                            );
                          }
                          if (component.type === "BUTTONS") {
                            return (
                              <div key={component.id} className="wa-preview-buttons">
                                {component.buttons.map((btn) => (
                                  <div key={btn.id} className="wa-preview-button border-[#E6E6E6] hover:bg-[#F9F9F9]">
                                    {btn.text || btn.type}
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          if (component.type === "CAROUSEL") {
                            return (
                              <div key={component.id} className="wa-preview-carousel">
                                {component.cards.map((card) => (
                                  <div key={card.id} className="wa-preview-card border-[#E6E6E6] rounded shadow-sm">
                                    <strong className="text-[10px] text-[#7A7A7A]">{card.headerType}</strong>
                                    <p className="text-[12px]">{replaceVariables(card.bodyText, SAMPLE_VALUES)}</p>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          if (component.type === "AUTHENTICATION") {
                            return (
                              <div key={component.id} className="wa-preview-bubble wa-preview-auth bg-slate-50 border-[#E6E6E6]">
                                <p className="font-semibold">Security recommendation: OTP Code</p>
                                <span className="font-mono text-xl tracking-widest text-[#E31E24]">992 018</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>

                    {/* Schema result payload info */}
                    <div className="wa-preview-meta">
                      <div className="wa-json-card border rounded p-3">
                        <div className="wa-json-card-title text-[#E31E24] font-bold text-[11px] mb-2 uppercase">Validation Report</div>
                        <pre className="text-[12px] text-[#1A1A1A] bg-white border rounded p-2 overflow-auto max-h-[160px] font-mono leading-relaxed">
                          {editorError || "Template is valid and ready to submit to Tata telecom BSP."}
                        </pre>
                      </div>
                      <div className="wa-json-card border rounded p-3">
                        <div className="wa-json-card-title text-[#E31E24] font-bold text-[11px] mb-2 uppercase">Meta Compiled Payload JSON</div>
                        <pre className="text-[11px] text-[#1A1A1A] bg-white border rounded p-2 overflow-auto max-h-[280px] font-mono leading-relaxed">
                          {payload ? JSON.stringify(payload, null, 2) : "Fill in all required component fields to preview the JSON."}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Testing & Actions toolbar */}
                <div className="wa-template-test-row border-t border-[#E6E6E6] pt-4 mt-6 flex flex-col gap-4">
                  <div className="flex gap-4 items-end">
                    <div className="w-full">
                      <LocalInput label="Test Recipient Mobile" value={testRecipient} onChange={(e: any) => setTestRecipient(e.target.value)} placeholder="+919876543210 (include country code)" />
                    </div>
                  </div>

                  {/* Actions matching reference layouts */}
                  <div className="wa-template-editor-actions flex gap-2 justify-start mt-2">
                    <button
                      onClick={() => setViewSource(viewSource === "form" ? "preview" : "form")}
                      className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-4 py-2 rounded font-bold text-[13px] transition flex items-center gap-1.5 bg-white uppercase tracking-wider"
                    >
                      <Eye size={13} /> PREVIEW
                    </button>

                    <button
                      onClick={sendTest}
                      disabled={testSendMutation.isPending || !selectedId}
                      className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-4 py-2 rounded font-bold text-[13px] transition flex items-center gap-1.5 bg-white uppercase tracking-wider disabled:opacity-50"
                    >
                      <Send size={13} /> SEND TEST
                    </button>

                    <button
                      onClick={() => void refreshStatus(selectedId)}
                      disabled={refreshMutation.isPending || !selectedId}
                      className="border border-[#E6E6E6] hover:bg-[#F9F9F9] text-[#1A1A1A] px-4 py-2 rounded font-bold text-[13px] transition flex items-center gap-1.5 bg-white uppercase tracking-wider disabled:opacity-50"
                    >
                      <RefreshCw size={13} /> REFRESH STATUS
                    </button>

                    {/* Always keep a Primary action to allow local saves & submissions */}
                    <button
                      onClick={saveTemplate}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="bg-[#E31E24] hover:bg-[#C1171C] text-white px-5 py-2 rounded font-bold text-[13px] transition flex items-center gap-1.5 shadow-sm uppercase tracking-wider ml-auto"
                    >
                      {createMutation.isPending || updateMutation.isPending ? "Saving..." : selectedId ? "Update Template" : "Create Template"}
                    </button>
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="wa-template-selected text-[11px] text-[#7A7A7A] border-t border-[#E6E6E6] pt-3 mt-4">
                    <span>Selected Record: <strong>{selectedTemplate.name}</strong> ({selectedTemplate.category} • {selectedTemplate.language})</span>
                    <span>Sync Status: <strong className="uppercase">{selectedTemplate.status}</strong></span>
                  </div>
                )}

                {testResponse && (
                  <div className="wa-json-card border border-[#E6E6E6] bg-slate-50 p-3 rounded mt-4">
                    <div className="wa-json-card-title text-[10px] font-bold uppercase tracking-wider text-[#7A7A7A] mb-1">Tata API Dispatch Log</div>
                    <pre className="text-[11px] text-[#1A1A1A] overflow-auto max-h-[140px] font-mono leading-relaxed bg-white border p-2 rounded">
                      {JSON.stringify(testResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </section>
            )}

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
