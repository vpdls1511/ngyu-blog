export interface Post {
  slug: string;
  category: string;
  title: string;
  date: string;
  coverImage?: string;
  excerpt?: string;
  content: string;
  assetsPath: string;
  author?: {
    name: string;
    picture: string;
  };
  ogImage?: {
    url: string;
  };
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  date: string;
  coverImage?: string;
  content: string;
  assetsPath: string;
  tech: string[];
  github?: string;
  demo?: string;
}
