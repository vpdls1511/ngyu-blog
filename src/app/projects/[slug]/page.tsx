import {getAllPosts, getAllProjects, getProjectBySlug} from '@/lib/api'
import Container from '@/app/_components/container'
import Link from 'next/link'
import {DateUtil} from '@/lib/DateUtil'
import Image from 'next/image'
import {PostBody} from '@/app/_components/posts/post-body'
import {TableOfContents} from '@/app/_components/posts/table-of-contents'
import markdownToHtml from '@/lib/markdownToHtml'
import {notFound} from 'next/navigation'
import {extractHeadings} from '@/lib/extractHeadings'
import React from 'react'

/**
 * 프로젝트 기간 포맷팅
 * @param dateString "2025-10 ~ " 또는 "2025-10 ~ 2025-11"
 */
const formatProjectPeriod = (dateString: string) => {
  // "2025-10 ~ " 형식 체크 (진행중)
  if (dateString.trim().endsWith('~')) {
    const startDate = dateString.replace('~', '').trim()
    return {
      text: `${startDate} ~`,
      isOngoing: true,
    }
  }

  // "2025-10 ~ 2025-11" 형식
  if (dateString.includes('~')) {
    return {
      text: dateString.trim(),
      isOngoing: false,
    }
  }

  // 단일 날짜 (혹시 몰라서)
  return {
    text: dateString.trim(),
    isOngoing: false,
  }
}

type Params = {
  params: {
    slug: string;
  };
};

export default async function Page({params}: Params) {
  const project = await getProjectBySlug(params.slug)

  if (!project) {
    return notFound()
  }

  const period = formatProjectPeriod(project.date)

  const content = await markdownToHtml(project.content || '')
  const headings = extractHeadings(project.content || '')

  return (
    <main>
      <Container>
        <div className="flex gap-12 xl:gap-16">
          {/* 메인 컨텐츠 */}
          <article className="flex-1 min-w-0 py-10 w-full xl:w-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              {period.isOngoing && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded">
                진행중
              </span>
              )}
              <time className="text-xs text-gray-400">
                {period.text}
              </time>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10">
              {project.title}
            </h1>

            {/* GitHub 링크 */}
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"/>
                </svg>
                View on GitHub
              </a>
            )}

            {/* 커버 이미지 */}
            {project.coverImage && (
              <div className="relative w-full aspect-video mb-10 rounded-lg overflow-hidden">
                <Image
                  src={project.coverImage}
                  alt={project.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            <div className="prose prose-gray max-w-none">
              <PostBody content={content}/>
            </div>
          </article>

          {/* 목차 - xl(1280px) 미만에서 숨김 */}
          <aside className="hidden xl:block w-40 flex-shrink-0 opacity-0 animate-fade-in-delay">
            <TableOfContents headings={headings}/>
          </aside>
        </div>
      </Container>
    </main>
  )
}
