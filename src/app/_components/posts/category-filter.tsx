// app/_components/posts/category-filter.tsx
'use client';

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  categories: string[];
  selectedCategory?: string;
};

export function CategoryFilter({ categories, selectedCategory }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        href="/posts"
        className={`
          px-3 py-1.5 rounded-full text-sm transition-colors
          ${
          !selectedCategory
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
        `}
      >
        전체
      </Link>
      {categories.map((category) => (
        <Link
          key={category}
          href={`/posts?category=${encodeURIComponent(category)}`}
          className={`
            px-3 py-1.5 rounded-full text-sm transition-colors
            ${
            selectedCategory === category
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }
          `}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
