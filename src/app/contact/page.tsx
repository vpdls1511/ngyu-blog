// app/contact/page.tsx
import Container from '@/app/_components/container'
import Link from 'next/link'

export default function ContactPage() {
  return (
    <main>
      <Container>
        <div className="py-20 max-w-2xl mx-auto animate-fade-in">
          {/* 간단한 인사 */}
          <div className="mb-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Contact
            </h1>
            <p className="text-base text-gray-600">
              궁금한 점이 있으시다면 아래 링크를 통해 연락주세요.
            </p>
          </div>

          {/* 링크 목록 */}
          <div className="space-y-4 opacity-0 animate-fade-in-delay">
            <ContactLink
              label="GitHub"
              href="https://github.com/vpdls1511"
              description="코드와 프로젝트를 확인하실 수 있어요"
            />

            <ContactLink
              label="Resume"
              href="https://www.rallit.com/hub/resumes/1538040/%EA%B9%80%EB%82%A8%EA%B7%9C"
              description="Rallit 이력서 보러가기"
            />

            <ContactLink
              label="LinkedIn"
              href="https://www.linkedin.com/in/%EB%82%A8%EA%B7%9C-%EA%B9%80-78b624157/"
              description="프로필 보기"
            />
          </div>
        </div>
      </Container>
    </main>
  )
}

function ContactLink({label, href, description}: {
  label: string;
  href: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-gray-900 group-hover:text-gray-700">
            {label}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        </div>
        <svg
          className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </a>
  )
}
