import { cn } from "@/utils/cn";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
}

/** Inline SVG monogram + wordmark, reused in the header and the footer (light variant on the red footer background). */
export function Logo({ variant = "dark", className }: LogoProps) {
  const stroke = variant === "light" ? "#fff" : "#E31E24";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 flex-none">
        <circle cx="20" cy="20" r="18" stroke={stroke} strokeWidth="2" />
        <path d="M12 27V13l8 9 8-9v14" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {variant === "dark" ? (
        <span className="leading-tight">
          <b className="block text-[19px] font-semibold tracking-tight text-ink">Modern</b>
          <span className="block text-[13px] font-normal tracking-wide text-steel">Orthodontics</span>
        </span>
      ) : (
        <span className="text-[22px] tracking-tight text-white">Modern Orthodontics</span>
      )}
    </div>
  );
}
