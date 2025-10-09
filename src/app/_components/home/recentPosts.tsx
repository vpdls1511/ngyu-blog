import Link from "next/link";

type Post = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
};

type RecentPostsProps = {
  posts: Post[];
};

export default function RecentPosts({ posts }: RecentPostsProps) {
  const recentPosts = posts.slice(0, 5);

  return (
    <section className="py-10 border-t border-gray-100">
      <div className="space-y-6">
        <h2 className="text-base text-gray-900 opacity-0 animate-fade-in">
          Recent Posts
        </h2>

        <div className="space-y-4 opacity-0 animate-fade-in-delay">
          {recentPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/posts/${post.slug}`}
              className="block group"
            >
              <article className="space-y-1">
                <h3 className="text-sm text-gray-900 group-hover:text-gray-600 transition-colors">
                  {post.title}
                </h3>
                <time className="text-xs text-gray-400">
                  {post.date}
                </time>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
