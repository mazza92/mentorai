import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plans: search sharper, skip the bait',
  description:
    "Don't trust the thumbnail. Search is free. Pro is €15/mo for 60 playbooks and 250 questions.",
  alternates: { canonical: 'https://lurnia.app/pricing' }
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
