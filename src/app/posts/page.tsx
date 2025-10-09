// app/posts/page.tsx
import Container from '@/app/_components/container'
import {getAllPosts, getCategories} from '@/lib/api'
import {PostCard} from '@/app/_components/posts/post-card'
import {CategoryFilter} from '@/app/_components/posts/category-filter'

export default function Post() {
  const allPosts = getAllPosts()
  const categories = getCategories()

  return (
    <main>
      <Container>
        <div className="py-10">
          {/* 헤더 */}
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Posts
            </h1>
            <p className="text-sm text-gray-500">
              {allPosts.length}개의 글
            </p>
          </div>

          {/* 카테고리 필터 */}
          <CategoryFilter
            categories={categories}
            selectedCategory={''}
          />


          <div className="mt-8 space-y-6 opacity-0 animate-fade-in">
            {/* 포스트 목록 */}
            {allPosts.map((post) => (
              <PostCard key={`${post.category}-${post.slug}`} post={post}/>
            ))}

            {/* 빈 상태 */}
            {allPosts.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500">포스트가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  )
}
