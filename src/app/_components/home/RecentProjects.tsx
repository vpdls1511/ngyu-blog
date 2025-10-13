import React from 'react';
import Link from 'next/link';
import { Project } from '@/interfaces/content';

type RecentProjectsProps = {
  projects: Project[];
  maxProjects?: number;
};

/**
 * 프로젝트 기간 포맷팅
 * @param dateString "2025-10 ~ " 또는 "2025-10 ~ 2025-11"
 */
const formatProjectPeriod = (dateString: string) => {
  // "2025-10 ~ " 형식 체크 (진행중)
  if (dateString.trim().endsWith('~')) {
    const startDate = dateString.replace('~', '').trim();
    return {
      text: `${startDate} ~`,
      isOngoing: true,
    };
  }

  // "2025-10 ~ 2025-11" 형식
  if (dateString.includes('~')) {
    return {
      text: dateString.trim(),
      isOngoing: false,
    };
  }

  // 단일 날짜 (혹시 몰라서)
  return {
    text: dateString.trim(),
    isOngoing: false,
  };
};

const ProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const period = formatProjectPeriod(project.date);

  return (
    <Link href={`/projects/${project.slug}`}>
      <article
        className="group cursor-pointer opacity-0 animate-fade-in-delay"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        {/* Cover Image */}
        <div className="relative w-full aspect-video mb-3 overflow-hidden rounded-lg bg-gray-50">
          <img
            src={project.coverImage}
            alt={project.title}
            className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80"
          />
        </div>

        {/* Content */}
        <div className="space-y-1">
          {/* Period */}
          <div className="flex items-center gap-2">
            <time className="text-xs text-gray-400">
              {period.text}
            </time>
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-600 transition-colors">

            {period.isOngoing && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded">
                진행중
              </span>
            )} {project.title}
          </h3>

          {/* Excerpt */}
          <p className="text-xs text-gray-400 line-clamp-2">
            {project.excerpt}
          </p>
        </div>
      </article>
    </Link>
  );
};

export default function RecentProjects({ projects, maxProjects = 3 }: RecentProjectsProps) {
  const displayProjects = projects.slice(0, maxProjects);

  return (
    <section className="py-10 border-t border-gray-100 opacity-0 animate-fade-in-delay-three">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900 opacity-0 animate-fade-in">
          Recent Projects
        </h2>

        {/* More Button - Desktop */}
        <Link href="/projects">
          <button className="hidden md:flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors opacity-0 animate-fade-in">
            <span>View All</span>
            <svg
              className="w-3 h-3"
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
          </button>
        </Link>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {displayProjects.map((project, index) => (
          <ProjectCard key={project.slug} project={project} index={index} />
        ))}
      </div>

      {/* More Button - Mobile */}
      <div className="mt-6 md:hidden opacity-0 animate-fade-in-delay">
        <Link href="/projects">
          <button className="w-full flex items-center justify-center gap-1 py-3 text-xs text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-100">
            <span>View All Projects</span>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </Link>
      </div>
    </section>
  );
}
