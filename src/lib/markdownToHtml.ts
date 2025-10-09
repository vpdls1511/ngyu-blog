// lib/markdownToHtml.ts
import { remark } from 'remark'
import html from 'remark-html'
import { createHighlighter } from 'shiki'

let highlighterInstance: any = null

async function getHighlighterInstance() {
  if (!highlighterInstance) {
    highlighterInstance = await createHighlighter({
      themes: ['tokyo-night'],
      langs: [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'css',
        'bash',
        'python',
        'java',
        'kotlin',
        'json',
        'yaml',
        'markdown',
        'html',
        'sql',
      ],
    })
  }
  return highlighterInstance
}

export default async function markdownToHtml(markdown: string) {
  const result = await remark()
    .use(html, { sanitize: false })
    .process(markdown)

  let htmlString = result.toString()

  // 제목에 ID 추가
  htmlString = htmlString.replace(
    /<h([1-3])>(.+?)<\/h\1>/g,
    (match, level, text) => {
      const id = text
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
  );

  // 코드 블록 처리
  const codeBlockRegex = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g
  const matches = [...htmlString.matchAll(codeBlockRegex)]

  if (matches.length > 0) {
    const highlighter = await getHighlighterInstance()

    for (const match of matches) {
      const [fullMatch, lang, code] = match

      let decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trimEnd()

      try {
        const highlighted = highlighter.codeToHtml(decodedCode, {
          lang,
          theme: 'tokyo-night',
        })

        const lineCount = decodedCode.split('\n').length

        const withHeader = `
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">${lang}</span>
              <span class="code-lines">${lineCount} lines</span>
            </div>
            <div class="code-wrapper">${highlighted}</div>
          </div>
        `

        htmlString = htmlString.replace(fullMatch, withHeader)
      } catch (error) {
        console.warn(`Failed to highlight code block with language: ${lang}`, error)
      }
    }
  }

  return htmlString
}
