export interface BlogItem {
  image: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  slug: string;
  url: string;
  ctaLabel: string;
  primary?: boolean;
}

export interface TestimonialItem {
  name: string;
  quote: string;
}
