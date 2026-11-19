"use client";

import { useRef, type KeyboardEvent } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/*
 * Comment box with a small formatting toolbar.
 *
 * Formatting is saved as light Markdown inside the plain comment text:
 *   **bold**, *italic*, "- " bullet lines and "1. " numbered lines.
 * That keeps comments readable everywhere they are shown as plain text
 * (emails, the client portal, activity lists), while <FormattedComment>
 * renders them with real bold, italics and lists.
 */

interface CommentEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

const BULLET_RE = /^(\s*)[-*•]\s+/;
const NUMBER_RE = /^(\s*)(\d+)[.)]\s+/;

export function CommentEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
  className,
}: CommentEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Apply a change and put the selection back where the user expects it.
  const apply = (next: string, selStart: number, selEnd: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const wrap = (marker: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e);
    // Toggle off when the selection is already wrapped in this marker.
    const before = value.slice(s - marker.length, s);
    const after = value.slice(e, e + marker.length);
    if (selected && before === marker && after === marker) {
      const next = value.slice(0, s - marker.length) + selected + value.slice(e + marker.length);
      apply(next, s - marker.length, e - marker.length);
      return;
    }
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    apply(next, s + marker.length, e + marker.length);
  };

  const toggleList = (kind: "bullet" | "number") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const nextBreak = value.indexOf("\n", e);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const re = kind === "bullet" ? BULLET_RE : NUMBER_RE;
    const allListed = lines.every((l) => !l.trim() || re.test(l));
    let n = 0;
    const updated = lines.map((line) => {
      const bare = line.replace(BULLET_RE, "$1").replace(NUMBER_RE, "$1");
      if (allListed) return bare;
      if (!line.trim() && lines.length > 1) return line;
      n += 1;
      return kind === "bullet" ? `- ${bare}` : `${n}. ${bare}`;
    });
    const block = updated.join("\n");
    const next = value.slice(0, lineStart) + block + value.slice(lineEnd);
    apply(next, lineStart + block.length, lineStart + block.length);
  };

  // Enter inside a list continues it; Enter on an empty item ends the list.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    if (event.key === "Enter" && !event.shiftKey && el.selectionStart === el.selectionEnd) {
      const pos = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      const line = value.slice(lineStart, pos);
      const bullet = line.match(BULLET_RE);
      const numbered = line.match(NUMBER_RE);
      const match = bullet ?? numbered;
      if (!match) return;
      event.preventDefault();
      if (line.slice(match[0].length).trim() === "") {
        const next = value.slice(0, lineStart) + value.slice(pos);
        apply(next, lineStart, lineStart);
        return;
      }
      const prefix = bullet
        ? `${bullet[1]}- `
        : `${numbered![1]}${Number(numbered![2]) + 1}. `;
      const insert = `\n${prefix}`;
      const next = value.slice(0, pos) + insert + value.slice(pos);
      apply(next, pos + insert.length, pos + insert.length);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        wrap("**");
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        wrap("*");
      }
    }
  };

  const tools = [
    { label: "Bold (Ctrl+B)", Icon: Bold, run: () => wrap("**") },
    { label: "Italic (Ctrl+I)", Icon: Italic, run: () => wrap("*") },
    { label: "Bulleted list", Icon: List, run: () => toggleList("bullet") },
    { label: "Numbered list", Icon: ListOrdered, run: () => toggleList("number") },
  ];

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-input px-1.5 py-1">
        {tools.map(({ label, Icon, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            // Keep the textarea's selection while clicking a toolbar button.
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <Textarea
        ref={ref}
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="border-0 shadow-none focus-visible:ring-0 rounded-t-none"
      />
    </div>
  );
}

export default CommentEditor;
