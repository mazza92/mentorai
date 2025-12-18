import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import Script from 'next/script'

export interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  // Generate Breadcrumb Schema.org structured data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": "https://lurnia.app"
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 2,
        "name": item.label,
        "item": `https://lurnia.app${item.href}`
      }))
    ]
  }

  return (
    <>
      {/* Structured Data for Breadcrumbs */}
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}
      >
        <Link
          href="/"
          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Accueil</span>
        </Link>

        {items.map((item, index) => (
          <div key={item.href} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-slate-400" />
            {index === items.length - 1 ? (
              <span className="text-slate-900 font-medium">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </>
  )
}
