import Link from 'next/link'
import Image from 'next/image'

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur bg-white/80 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link
            href="/"
            className="flex items-center space-x-2 group font-bold text-xl"
          >
            {/* 파비콘 */}
            <Image
              src="/favicon/blog-favicon.png"
              alt="ngyu blog favicon"
              width={35}
              height={35}
            />
            {/* 텍스트: 기본 숨김, hover 시 나타남 */}
            <span className="text-gray-700 text-sm opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
          ngyu.me
        </span>
          </Link>

          {/* 우측 네비게이션 */}
          <nav className="flex items-center space-x-6">
            {/* Posts 링크 */}
            <Link
              href="/posts"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Posts
            </Link>

            {/* Projects 링크 */}
            <Link
              href="/projects"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Projects
            </Link>

            {/* Contact 링크 */}
            <Link
              href="/contact"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Contact
            </Link>

            {/* GitHub 아이콘 */}
            <a
              href="https://github.com/vpdls1511"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="GitHub"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </nav>
        </div>
      </div>
    </header>
  )

}

export default Header
