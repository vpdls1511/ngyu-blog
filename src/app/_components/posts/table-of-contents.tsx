// app/_components/table-of-contents.tsx
'use client'

import {useEffect, useState} from 'react'
import {Heading} from '@/lib/extractHeadings'

type Props = {
  headings: Heading[];
};

export function TableOfContents({headings}: Props) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {rootMargin: '-80px 0px -80% 0px'},
    )

    const headingElements = headings.map(({id}) =>
      document.getElementById(id),
    ).filter(Boolean)

    headingElements.forEach((element) => {
      if (element) observer.observe(element)
    })

    return () => {
      headingElements.forEach((element) => {
        if (element) observer.unobserve(element)
      })
    }
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav className="sticky top-24">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900 mb-4">목차</p>
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`
              block text-sm transition-colors py-1
              overflow-hidden text-ellipsis whitespace-nowrap
              ${heading.level === 1 ? '' : heading.level === 2 ? 'pl-4' : 'pl-8'}
              ${
              activeId === heading.id
                ? 'text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }
            `}
            title={heading.text}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(heading.id)?.scrollIntoView({
                behavior: 'smooth',
              })
            }}
          >
            {heading.text}
          </a>
        ))}
      </div>
    </nav>
  )
}
