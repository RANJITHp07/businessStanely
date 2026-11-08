"use client";

import { Fragment } from "react";

// http(s) links and bare www. addresses; trailing punctuation is left out of
// the link, like WhatsApp does.
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi;

/** Message text with web links shown in blue and opened in a new tab. */
export function MessageText({ text }: { text: string }) {
    const parts: Array<{ text: string; href?: string }> = [];
    let last = 0;
    for (const match of text.matchAll(LINK_PATTERN)) {
        const start = match.index ?? 0;
        if (start > last) parts.push({ text: text.slice(last, start) });
        const link = match[0];
        parts.push({ text: link, href: link.toLowerCase().startsWith("www.") ? `https://${link}` : link });
        last = start + link.length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });

    return (
        <>
            {parts.map((part, index) =>
                part.href ? (
                    <a
                        key={index}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="break-all text-[#53bdeb] underline-offset-2 hover:underline"
                    >
                        {part.text}
                    </a>
                ) : (
                    <Fragment key={index}>{part.text}</Fragment>
                ),
            )}
        </>
    );
}
