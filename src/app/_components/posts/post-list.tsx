'use client'

import { useSearchParams } from 'next/navigation'
import { PostCard } from './post-card'
import { CategoryFilter } from './category-filter'
import {Post} from '@/interfaces/content'


type PostListProps = {
  posts: Post[]
  categories: string[]
}

export function PostList({ posts, categories }: PostListProps) {
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get('category')

  // 카테고리 필터링
  const filteredPosts = selectedCategory
    ? posts.filter((post) => post.category === selectedCategory)
    : posts

  return (
    <>
      {/* 카테고리 필터 */}
      <div className="opacity-0 animate-fade-in-delay">
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory || undefined}
        />
      </div>

      <div className="mt-8 space-y-6 opacity-0 animate-fade-in-delay-three">
        {/* 포스트 목록 */}
        {filteredPosts.map((post) => (
          <PostCard key={`${post.category}-${post.slug}`} post={post} />
        ))}

        {/* 빈 상태 */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">포스트가 없습니다.</p>
          </div>
        )}
      </div>
    </>
  )
}
