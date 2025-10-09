import Container from '@/app/_components/container'
import {Intro} from '@/app/_components/home/intro'
import {getAllPosts} from '@/lib/api'
import RecentPosts from '@/app/_components/home/recentPosts'

export default function Index() {
  const allPosts = getAllPosts()

  const morePosts = allPosts.slice(0, 10)

  return (
    <main>
      <Container>
        {/* 모바일: 세로 정렬 / 데스크탑(md 이상): 가로 정렬 */}
        <div className="flex flex-col md:flex-row md:gap-16">
          {/* Intro */}
          <div className="w-full md:w-1/2">
            <Intro/>
          </div>

          {/* RecentPosts */}
          <div className="w-full md:w">
            <RecentPosts posts={morePosts}/>
          </div>
        </div>
      </Container>
    </main>
  )
}
