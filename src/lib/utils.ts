import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** @deprecated Use editor.getMarkdown() from `@tiptap/markdown` instead. */
export function htmlToMarkdown(html: string): string {
  let md = html;

  // Block-level elements
  md = md.replace(/<h1>(.*?)<\/h1>/gi, (_: string, text: string) => `# ${stripTags(text)}\n\n`);
  md = md.replace(/<h2>(.*?)<\/h2>/gi, (_: string, text: string) => `## ${stripTags(text)}\n\n`);
  md = md.replace(/<h3>(.*?)<\/h3>/gi, (_: string, text: string) => `### ${stripTags(text)}\n\n`);
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/gis, (_: string, text: string) =>
    text.split(/\n/).filter(Boolean).map((l: string) => `> ${stripTags(l)}`).join("\n") + "\n\n"
  );

  // Lists
  md = md.replace(/<ul>(.*?)<\/ul>/gis, (_: string, content: string) => {
    const items = content.match(/<li>(.*?)<\/li>/gi) || [];
    return items.map((li: string) => `- ${stripTags(li.replace(/<\/?li>/gi, ""))}`).join("\n") + "\n\n";
  });
  md = md.replace(/<ol>(.*?)<\/ol>/gis, (_: string, content: string) => {
    const items = content.match(/<li>(.*?)<\/li>/gi) || [];
    return items.map((li: string, i: number) => `${i + 1}. ${stripTags(li.replace(/<\/?li>/gi, ""))}`).join("\n") + "\n\n";
  });

  // Paragraphs
  md = md.replace(/<p>(.*?)<\/p>/gi, (_: string, text: string) => `${stripTags(text)}\n\n`);

  // Inline formatting
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<s>(.*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<del>(.*?)<\/del>/gi, "~~$1~~");
  md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, "[$2]($1)");

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Clean up remaining tags and entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  // Collapse multiple blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim() + "\n";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
