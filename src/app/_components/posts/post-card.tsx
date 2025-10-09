// app/_components/posts/post-card.tsx
import Link from "next/link";
import { Post } from "@/interfaces/content";
import { DateUtil } from "@/lib/DateUtil";

type Props = {
  post: Post;
};

export function PostCard({ post }: Props) {
  return (
    <Link
      href={`/posts/${post.category}/${post.slug}`}
      className="block group"
    >
      <article className="border-b border-gray-100 pb-6 hover:border-gray-200 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400 uppercase">
            {post.category}
          </span>
          <span className="text-xs text-gray-300">·</span>
          <time className="text-xs text-gray-400">
            {DateUtil.format(post.date, 'YYYY-MM-DD')}
          </time>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {post.excerpt}
          </p>
        )}
      </article>
    </Link>
  );
}
