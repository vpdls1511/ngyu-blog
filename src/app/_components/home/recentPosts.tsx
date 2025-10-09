import Link from "next/link";
import { DateUtil } from '@/lib/DateUtil';
import { Post } from '@/interfaces/content';

type RecentPostsProps = {
  posts: Post[];
};

export default function RecentPosts({ posts }: RecentPostsProps) {
  const recentPosts = posts.slice(0, 5);

  return (
    <section className="py-10 border-t border-gray-100">
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-gray-900 opacity-0 animate-fade-in">
          Recent Posts
        </h2>

        <div className="space-y-4 opacity-0 animate-fade-in-delay">
          {recentPosts.map((post) => (
            <Link
              key={`${post.category}-${post.slug}`}
              href={`/posts/${post.category}/${post.slug}`}
              className="block group"
            >
              <article className="space-y-1">
                <h3 className="flex flex-row text-sm text-gray-900 group-hover:text-gray-600 transition-colors items-center">
                  <span className="text-xs text-gray-400 uppercase">
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-300 mx-1">·</span>
                  {post.title}
                </h3>
                <time className="text-xs text-gray-400">
                {DateUtil.format(post.date, 'YYYY-MM-DD')}
                </time>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
