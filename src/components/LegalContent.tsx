import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Renders the restricted markup subset used by legal documents.
 *
 * Deliberately *not* a full Markdown parser and never `dangerouslySetInnerHTML`:
 * page bodies are editable from the admin area, so treating them as data rather
 * than HTML removes stored-XSS as a possibility entirely.
 *
 * Supported: `## heading`, `### heading`, `- bullet`, `1. numbered`,
 * `**bold**`, `_italic_`, `[text](/link)`, and blank-line paragraphs.
 */
export function LegalContent({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);
  const output: ReactNode[] = [];

  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList(key: string) {
    if (listBuffer.length === 0 || !listType) return;

    const items = listBuffer.map((item, index) => <li key={index}>{renderInline(item)}</li>);
    output.push(
      listType === 'ul' ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>,
    );

    listBuffer = [];
    listType = null;
  }

  blocks.forEach((raw, blockIndex) => {
    const block = raw.trim();
    if (!block) return;

    const lines = block.split('\n').map((line) => line.trim());

    // A block made entirely of "- " lines is a bullet list.
    if (lines.every((line) => line.startsWith('- '))) {
      flushList(`list-${blockIndex}-flush`);
      listType = 'ul';
      listBuffer = lines.map((line) => line.slice(2));
      flushList(`list-${blockIndex}`);
      return;
    }

    // …and one of "1. " lines is a numbered list.
    if (lines.every((line) => /^\d+\.\s/.test(line))) {
      flushList(`list-${blockIndex}-flush`);
      listType = 'ol';
      listBuffer = lines.map((line) => line.replace(/^\d+\.\s/, ''));
      flushList(`list-${blockIndex}`);
      return;
    }

    if (block.startsWith('### ')) {
      output.push(<h3 key={blockIndex}>{renderInline(block.slice(4))}</h3>);
      return;
    }

    if (block.startsWith('## ')) {
      output.push(<h2 key={blockIndex}>{renderInline(block.slice(3))}</h2>);
      return;
    }

    output.push(<p key={blockIndex}>{renderInline(block.replace(/\n/g, ' '))}</p>);
  });

  return <div className="prose-legal">{output}</div>;
}

/** Handles bold, italic and links inside a block of text. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // One pass over links, bold and italic, in that precedence.
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, linkText, href, bold, italic] = match;

    if (linkText && href) {
      // Only internal links get the client-side router; anything else is
      // rendered as a plain anchor with safe rel attributes.
      nodes.push(
        href.startsWith('/') ? (
          <Link key={key} href={href}>
            {linkText}
          </Link>
        ) : (
          <a key={key} href={href} rel="noopener noreferrer nofollow" target="_blank">
            {linkText}
          </a>
        ),
      );
    } else if (bold) {
      nodes.push(<strong key={key}>{bold}</strong>);
    } else if (italic) {
      nodes.push(<em key={key}>{italic}</em>);
    }

    key += 1;
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
