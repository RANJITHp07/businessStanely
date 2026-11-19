import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Renders comment text written with <CommentEditor>: **bold**, *italic*,
 * "- " bullet lines, "1. " numbered lines and line breaks. Older plain-text
 * comments render exactly as typed. Built from React elements only (no
 * innerHTML), so comment text can never inject markup.
 */

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const INLINE_RE = /(\*\*[^*\n]+?\*\*|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (
      part.length > 2 &&
      ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_")))
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; start: number; items: string[] }
  | { kind: "p"; lines: string[] }
  | { kind: "gap" };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const last = blocks[blocks.length - 1];
    const bullet = line.match(BULLET_RE);
    const numbered = line.match(NUMBER_RE);
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[2]);
      else blocks.push({ kind: "ol", start: Number(numbered[1]) || 1, items: [numbered[2]] });
    } else if (!line.trim()) {
      if (last && last.kind !== "gap") blocks.push({ kind: "gap" });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  if (blocks[blocks.length - 1]?.kind === "gap") blocks.pop();
  return blocks;
}

export function FormattedComment({
  content,
  className,
}: {
  content?: string | null;
  className?: string;
}) {
  if (!content) return null;
  return (
    <div className={cn("text-sm leading-relaxed break-words space-y-1", className)}>
      {toBlocks(content).map((block, i) => {
        switch (block.kind) {
          case "ul":
            return (
              <ul key={i} className="list-disc pl-5 space-y-0.5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} start={block.start} className="list-decimal pl-5 space-y-0.5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "gap":
            return <div key={i} className="h-1" aria-hidden="true" />;
          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {block.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(line)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

export default FormattedComment;
