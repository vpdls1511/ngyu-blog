// app/posts/[category]/[slug]/page.tsx
import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getAllPosts, getPostBySlug} from '@/lib/api'
import {CMS_NAME} from '@/lib/constants'
import markdownToHtml from '@/lib/markdownToHtml'
import Container from '@/app/_components/container'
import {PostBody} from '@/app/_components/posts/post-body'
import {DateUtil} from '@/lib/DateUtil'
import Link from 'next/link'
import {extractHeadings} from '@/lib/extractHeadings'
import {TableOfContents} from '@/app/_components/posts/table-of-contents'

export async function generateStaticParams() {
  const posts = getAllPosts()

  return posts.map((post) => ({
    category: encodeURIComponent(post.category),
    slug: encodeURIComponent(post.slug),
  }))
}

type Params = {
  params: {
    category: string;
    slug: string;
  };
};

export default async function Post({params}: Params) {
  const category = decodeURIComponent(params.category)
  const slug = decodeURIComponent(params.slug)

  const post = getPostBySlug(category, slug)

  if (!post) {
    return notFound()
  }

  const content = await markdownToHtml(post.content || '')
  const headings = extractHeadings(post.content || '')

  return (
    <main>
      <Container>
        <div className="flex gap-12 xl:gap-16">
          {/* 메인 컨텐츠 */}
          <article className="flex-1 min-w-0 py-10 w-full xl:w-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <Link
                href={`/posts?category=${encodeURIComponent(post.category)}`}
                className="text-xs text-gray-400 uppercase hover:text-gray-600 transition-colors"
              >
                {post.category}
              </Link>
              <span className="text-xs text-gray-300 mx-0.5">·</span>
              <time className="text-xs text-gray-400">
                {DateUtil.format(post.date, 'YYYY-MM-DD')}
              </time>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10">
              {post.title}
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

export function generateMetadata({params}: Params): Metadata {
  const category = decodeURIComponent(params.category)
  const slug = decodeURIComponent(params.slug)

  const post = getPostBySlug(category, slug)

  if (!post) {
    return notFound()
  }

  const title = `${post.title} | ${CMS_NAME}`

  return {
    title,
    openGraph: {
      title,
      images: post.ogImage?.url ? [post.ogImage.url] : [],
    },
  }
}
