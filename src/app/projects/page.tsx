// app/posts/page.tsx
export const dynamic = 'force-dynamic'  // 반드시 최상단에 선언

import Container from '@/app/_components/container'
import {getAllPosts, getAllProjects, getCategories} from '@/lib/api'
import { PostCard } from '@/app/_components/posts/post-card'
import { CategoryFilter } from '@/app/_components/posts/category-filter'

type SearchParams = {
  searchParams: {
    category?: string
  }
}

export default function PostsPage({ searchParams }: SearchParams) {
  const allProjects = getAllProjects()

  return (
    <main>
      <Container>
        <div className="py-10">
          {/* 헤더 */}
          <div className="mb-10 animate-fade-in">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Projects
            </h1>
            <p className="text-sm text-gray-500">{allProjects.length}개의 프로젝트</p>
          </div>

          {/* 포스트 목록 */}
          <div className="mt-8 space-y-6 opacity-0 animate-fade-in-delay-three">
            {/*{allProjects.map((post) => (*/}
            {/*  <PostCard key={`${post.category}-${post.slug}`} post={post} />*/}
            {/*))}*/}

            {allProjects.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500">프로젝트가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  )
}
