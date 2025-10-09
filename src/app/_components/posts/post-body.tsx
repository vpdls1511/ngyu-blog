type Props = {
  content: string;
};

export function PostBody({ content }: Props) {
  return (
    <div
      className="prose prose-gray max-w-none
        prose-pre:p-0 prose-pre:bg-transparent
        prose-code:text-sm prose-code:font-normal
        prose-headings:font-bold prose-headings:text-gray-900
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-gray-900 prose-strong:font-semibold
        prose-ul:text-gray-700 prose-ol:text-gray-700
        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:italic prose-blockquote:text-gray-600"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
