// app/posts/category/[category]/page.tsx
import Container from '@/app/_components/container'
import { getAllPosts, getCategories } from '@/lib/api'
import { PostCard } from '@/app/_components/posts/post-card'
import {CategoryFilter} from '@/app/_components/posts/category-filter'

type Params = { params: { category: string } }

export async function generateStaticParams() {
  const categories = getCategories()
  return categories.map((category) => ({ category }))
}

export default function CategoryPage({ params }: Params) {
  const category = params.category
  const allPosts = getAllPosts()
  const filteredPosts = allPosts.filter((post) => post.category === category)

  const categories = getCategories()

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Posts
            </h1>
            <p className="text-sm text-gray-500">
              {filteredPosts.length}개의 글
            </p>
          </div>

          <CategoryFilter
            categories={categories}
            selectedCategory={category}
          />

          <div className="mt-8 space-y-6 animate-fade-in">
            {filteredPosts.map((post) => (
              <PostCard key={`${post.category}-${post.slug}`} post={post}/>
            ))}
            {filteredPosts.length === 0 && (
              <div className="text-center py-20 text-gray-500">포스트가 없습니다.</div>
            )}
          </div>
        </div>
      </Container>
    </main>
  )
}
