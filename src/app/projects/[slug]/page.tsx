import {getAllPosts, getAllProjects, getProjectBySlug} from '@/lib/api'
import Container from '@/app/_components/container'
import Link from 'next/link'
import {DateUtil} from '@/lib/DateUtil'
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
    const startDate = dateString.replace('~', '').trim();
    return {
      text: `${startDate} ~`,
      isOngoing: true,
    };
  }

  // "2025-10 ~ 2025-11" 형식
  if (dateString.includes('~')) {
    return {
      text: dateString.trim(),
      isOngoing: false,
    };
  }

  // 단일 날짜 (혹시 몰라서)
  return {
    text: dateString.trim(),
    isOngoing: false,
  };
};

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

  const period = formatProjectPeriod(project.date);

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
