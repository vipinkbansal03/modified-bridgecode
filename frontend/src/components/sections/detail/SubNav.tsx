import { Container } from "@/components/ui/Container";

interface SubNavProps {
  items: { label: string; anchor: string }[];
}

export function SubNav({ items }: SubNavProps) {
  return (
    <div className="border-b border-line">
      <Container className="flex flex-wrap gap-8.5 py-5 text-sm">
        {items.map((item) => (
          <a key={item.anchor} href={`#${item.anchor}`} className="text-ink hover:text-brand">
            {item.label}
          </a>
        ))}
      </Container>
    </div>
  );
}
