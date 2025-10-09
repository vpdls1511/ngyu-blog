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
  // sanitize: false 이미 적용되어 있지만, 한 번 더 확인
  const result = await remark()
    .use(html, {
      sanitize: false,
      allowDangerousHtml: true  // 추가
    })
    .process(markdown)

  let htmlString = result.toString()

  // HTML 엔티티 디코딩을 먼저 수행
  htmlString = htmlString
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x3C;/g, '<')  // 추가
    .replace(/&#x3E;/g, '>')  // 추가
    .replace(/&amp;/g, '&')   // 마지막에 처리

  // 제목에 ID 추가
  htmlString = htmlString.replace(
    /<h([1-3])>(.+?)<\/h\1>/g,
    (match, level, text) => {
      const id = text
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
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

      // 이미 전체적으로 디코딩했으므로 추가 디코딩 불필요
      const decodedCode = code.trimEnd()

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
