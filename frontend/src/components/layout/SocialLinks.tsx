"use client";

import { cn } from "@/utils/cn";

type SocialPlatform = "facebook" | "instagram" | "linkedin" | "youtube" | "twitter" | "pinterest";

interface SocialLinksProps {
  social: Record<string, string | null | undefined> | null | undefined;
  className?: string;
  linkClassName?: string;
}

function SocialIcon({
  platform,
}: {
  platform: SocialPlatform;
}) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true as const,
  };

  switch (platform) {
    case "facebook":
      return (
        <svg {...common}>
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6H16.7V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H7.7v3h2.6v8h3.2Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <path d="M6.9 8.7a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8ZM5.3 19V10h3.2v9H5.3Zm5 0V10h3.1v1.3h.1c.4-.8 1.5-1.6 3-1.6 3.2 0 3.8 2.1 3.8 4.8V19H17v-3.9c0-.9 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V19h-3.7Z" />
        </svg>
      );
    case "twitter":
      return (
        <svg {...common}>
          <path d="M18.9 3H21l-4.6 5.3L21.8 21h-4.5l-3.5-4.6L9.8 21H7.7l4.9-5.7L2.2 3h4.6l3.2 4.2L13.7 3h5.2Zm-1.6 15.3h1.2L7.4 5.6H6.1l11.2 12.7Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM18.4 6.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0ZM21 18.5c-.1 1.3-.4 2.5-1.4 3.5s-2.2 1.3-3.5 1.4c-1.4.1-5.7.1-8.1 0-1.3-.1-2.5-.4-3.5-1.4s-1.3-2.2-1.4-3.5c-.1-1.4-.1-5.7 0-8.1.1-1.3.4-2.5 1.4-3.5S6.7 2.6 8 2.5c1.4-.1 5.7-.1 8.1 0 1.3.1 2.5.4 3.5 1.4s1.3 2.2 1.4 3.5c.1 1.4.1 5.7 0 8.1ZM19 7.7c-.1-.9-.2-1.4-.5-1.8-.4-.4-.9-.5-1.8-.5-1.3-.1-5.2-.1-6.5 0-.9 0-1.4.2-1.8.5-.4.4-.5.9-.5 1.8-.1 1.3-.1 5.2 0 6.5 0 .9.2 1.4.5 1.8.4.4.9.5 1.8.5 1.3.1 5.2.1 6.5 0 .9 0 1.4-.2 1.8-.5.4-.4.5-.9.5-1.8.1-1.3.1-5.2 0-6.5Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg {...common}>
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.966 1.406-5.966s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.164 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.622 0 11.988-5.366 11.988-11.987C24 5.368 18.64 0 12.017 0z" />
        </svg>
      );
  }
}

export function SocialLinks({ social, className, linkClassName }: SocialLinksProps) {
  if (!social) return null;

  const platforms: SocialPlatform[] = ["facebook", "instagram", "linkedin", "youtube", "twitter", "pinterest"];
  const activeLinks = platforms
    .map((platform) => ({
      platform,
      href: social[platform],
    }))
    .filter((item): item is { platform: SocialPlatform; href: string } => typeof item.href === "string" && item.href.trim().length > 0);

  if (activeLinks.length === 0) return null;

  return (
    <div className={cn("flex space-x-6", className)}>
      {activeLinks.map(({ platform, href }) => (
        <a
          key={platform}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("text-gray-400 hover:text-gray-500 transition-colors", linkClassName)}
          aria-label={platform.charAt(0).toUpperCase() + platform.slice(1)}
        >
          <SocialIcon platform={platform} />
        </a>
      ))}
    </div>
  );
}
