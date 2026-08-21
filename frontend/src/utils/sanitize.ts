/**
 * Storefront HTML Sanitization and Text Processing Utilities
 * Single trusted boundary for rendering CMS rich-text content safely.
 */

/**
 * Strips all HTML tags and decodes common HTML entities to return pure plain text.
 * Used for accurate character counting and text analysis.
 */
export function stripHtmlTags(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

/**
 * Returns the meaningful character count of HTML content (excluding markup tags and whitespace padding).
 */
export function getMeaningfulTextLength(html?: string | null): number {
  return stripHtmlTags(html).length;
}

const CATEGORY_ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "A",
  "P",
  "BR",
]);

const DANGEROUS_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "IMG",
  "FORM",
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
  "NOSCRIPT",
]);

/**
 * Safely sanitizes category description HTML for storefront display.
 * 
 * Rules:
 * 1. Disallows arbitrary <span> and inline style attributes (strips style, color, font-size, font-family).
 * 2. Unwraps non-allowed tags (e.g. <span>, <div>, <font>) so their inner text is preserved without styling.
 * 3. Whitelists only safe formatting tags: <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <a>, <p>, <br>.
 * 4. Strictly validates <a> href protocols (http, https, mailto, relative) and sets target="_blank" rel="noopener noreferrer".
 * 5. Completely eliminates dangerous tags (<script>, <iframe>, <img>, <button>, etc.) and event handlers (onclick, etc.).
 */
export function sanitizeCategoryDescription(html?: string | null): string {
  if (!html) return "";

  // Browser environment using DOMParser
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      function cleanNode(node: Node) {
        // Remove dangerous tags and their children completely
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toUpperCase();

          if (DANGEROUS_TAGS.has(tagName)) {
            el.remove();
            return;
          }

          // Clean child nodes first before unwrapping or modifying current element
          const children = Array.from(el.childNodes);
          children.forEach(cleanNode);

          if (!CATEGORY_ALLOWED_TAGS.has(tagName)) {
            // Unwrap non-whitelisted container elements (span, div, font, etc.)
            const fragment = doc.createDocumentFragment();
            while (el.firstChild) {
              fragment.appendChild(el.firstChild);
            }
            el.replaceWith(fragment);
            return;
          }

          // For allowed tags: strip all style, class, and event handler attributes
          const attributes = Array.from(el.attributes);
          for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith("on") || attrName === "style" || attrName === "class") {
              el.removeAttribute(attr.name);
            } else if (tagName === "A" && attrName === "href") {
              const href = attr.value.trim();
              if (
                !/^(https?:\/\/|mailto:|\/|#)/i.test(href) ||
                /^(javascript|vbscript|data):/i.test(href)
              ) {
                el.removeAttribute("href");
              } else {
                el.setAttribute("target", "_blank");
                el.setAttribute("rel", "noopener noreferrer");
              }
            } else if (tagName !== "A" || attrName !== "href") {
              el.removeAttribute(attr.name);
            }
          }
        }
      }

      Array.from(doc.body.childNodes).forEach(cleanNode);
      return doc.body.innerHTML.trim();
    } catch {
      // Fall through to regex-based fallback if DOMParser fails
    }
  }

  // Server-side / fallback regex-based sanitization
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<(iframe|object|embed|svg|img|form|input|button|select|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|svg|img|form|input|button|select|textarea|noscript)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/\shref=["']?\s*(?:javascript|vbscript|data):[^"'>\s]*/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sstyle='[^']*'/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sclass='[^']*'/gi, "")
    // Unwrap <span>, <div>, <font> tags while keeping text inside
    .replace(/<\/?(span|div|font|h[1-6]|ul|ol|li|blockquote|table|tr|td|th)\b[^>]*>/gi, "");

  return sanitized.trim();
}

/**
 * General storefront HTML sanitizer.
 */
export function sanitizeStorefrontHtml(html?: string | null): string {
  return sanitizeCategoryDescription(html);
}
