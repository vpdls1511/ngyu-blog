/**
 * # 사용법
 *
 * 모든 포스트 - const allPosts = getAllPosts();
 *
 * 특정 카테고리 포스트 - const devPosts = getPostsByCategory("development");
 *
 * 단일 포스트 - const post = getPostBySlug("development", "nextjs-tutorial");
 *
 * 모든 프로젝트 - const projects = getAllProjects();
 *
 * 단일 프로젝트 - const project = getProjectBySlug("portfolio-website");
 *
 * 카테고리 목록 - const categories = getCategories();
 *
 */

import { Post, Project } from "@/interfaces/content";
import fs from "fs";
import matter from "gray-matter";
import { join } from "path";

const contentDirectory = join(process.cwd(), "_content");

/**
 * 특정 디렉토리의 모든 하위 폴더 가져오기
 */
function getDirectories(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

/**
 * 특정 경로에서 index.md 파일 찾기
 */
function findMarkdownFile(dirPath: string): string | null {
  if (!fs.existsSync(dirPath)) return null;

  const indexPath = join(dirPath, "index.md");

  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  // index.md가 없으면 첫 번째 .md 파일 찾기
  try {
    const files = fs.readdirSync(dirPath);
    const mdFile = files.find((file) => file.endsWith(".md"));
    return mdFile ? join(dirPath, mdFile) : null;
  } catch (error) {
    console.warn(`Failed to read directory: ${dirPath}`);
    return null;
  }
}

/**
 * 카테고리별 포스트 슬러그 가져오기
 */
export function getPostSlugs(): Array<{ category: string; slug: string }> {
  const postsDir = join(contentDirectory, "posts");
  const categories = getDirectories(postsDir);

  const slugs: Array<{ category: string; slug: string }> = [];

  categories.forEach((category) => {
    const categoryPath = join(postsDir, category);
    const posts = getDirectories(categoryPath);

    posts.forEach((post) => {
      slugs.push({ category, slug: post });
    });
  });

  return slugs;
}

/**
 * 슬러그로 포스트 가져오기
 */
export function getPostBySlug(category: string, slug: string): Post | null {
  const postPath = join(contentDirectory, "posts", category, slug);
  const mdPath = findMarkdownFile(postPath);

  if (!mdPath) {
    console.warn(`Post not found: ${category}/${slug}`);
    return null;
  }

  try {
    const fileContents = fs.readFileSync(mdPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      ...data,
      category,
      slug,
      content,
      assetsPath: `/_content/posts/${category}/${slug}/assets`,
    } as Post;
  } catch (error) {
    console.error(`Failed to read post: ${category}/${slug}`, error);
    return null;
  }
}

/**
 * 모든 포스트 가져오기
 */
export function getAllPosts(): Post[] {
  const slugs = getPostSlugs();

  const posts = slugs
    .map(({ category, slug }) => getPostBySlug(category, slug))
    .filter((post): post is Post => post !== null)
    .sort((post1, post2) => {
      // 날짜 비교 개선
      const date1 = new Date(post1.date).getTime();
      const date2 = new Date(post2.date).getTime();
      return date2 - date1; // 최신순
    });

  return posts;
}

/**
 * 특정 카테고리의 포스트만 가져오기
 */
export function getPostsByCategory(category: string): Post[] {
  const allPosts = getAllPosts();
  return allPosts.filter((post) => post.category === category);
}

/**
 * 모든 카테고리 가져오기
 */
export function getCategories(): string[] {
  const postsDir = join(contentDirectory, "posts");
  return getDirectories(postsDir);
}

// ===== 프로젝트 관련 =====

/**
 * 프로젝트 슬러그 가져오기
 */
export function getProjectSlugs(): string[] {
  const projectsDir = join(contentDirectory, "projects");
  return getDirectories(projectsDir);
}

/**
 * 슬러그로 프로젝트 가져오기
 */
export function getProjectBySlug(slug: string): Project | null {
  const projectPath = join(contentDirectory, "projects", slug);
  const mdPath = findMarkdownFile(projectPath);

  if (!mdPath) {
    console.warn(`Project not found: ${slug}`);
    return null;
  }

  try {
    const fileContents = fs.readFileSync(mdPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      ...data,
      slug,
      content,
      assetsPath: `/_content/projects/${slug}/assets`,
    } as Project;
  } catch (error) {
    console.error(`Failed to read project: ${slug}`, error);
    return null;
  }
}

/**
 * 모든 프로젝트 가져오기
 */
export function getAllProjects(): Project[] {
  const slugs = getProjectSlugs();

  const projects = slugs
    .map((slug) => getProjectBySlug(slug))
    .filter((project): project is Project => project !== null)
    .sort((p1, p2) => {
      // 날짜 비교 개선
      const date1 = new Date(p1.date).getTime();
      const date2 = new Date(p2.date).getTime();
      return date2 - date1; // 최신순
    });

  return projects;
}
