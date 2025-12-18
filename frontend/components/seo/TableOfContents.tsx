'use client'

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  className?: string
}

export default function TableOfContents({ className = '' }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Extract H2 and H3 headings from article content
    const articleContent = document.querySelector('.article-content')
    if (!articleContent) return

    const headingElements = articleContent.querySelectorAll('h2, h3')
    const headingData: TOCItem[] = []

    headingElements.forEach((heading, index) => {
      const id = heading.id || `heading-${index}`
      if (!heading.id) {
        heading.id = id
      }

      headingData.push({
        id,
        text: heading.textContent || '',
        level: heading.tagName === 'H2' ? 2 : 3
      })
    })

    setHeadings(headingData)

    // Intersection Observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-100px 0px -80% 0px' }
    )

    headingElements.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [])

  if (headings.length === 0) return null

  return (
    <nav
      className={`bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24 ${className}`}
      aria-label="Table des matières"
    >
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Table des matières</h2>
      </div>

      <ul className="space-y-2">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={heading.level === 3 ? 'ml-4' : ''}
          >
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(heading.id)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                })
              }}
              className={`
                block py-1.5 px-3 rounded-lg text-sm transition-all
                ${activeId === heading.id
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
                }
              `}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
