import { useEffect, useState, useCallback } from "react";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface CodeViewerProps {
  noteId: string;
  path: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript (TSX)",
  js: "JavaScript",
  jsx: "JavaScript (JSX)",
  mjs: "JavaScript (ESM)",
  cjs: "JavaScript (CJS)",
  py: "Python",
  pyi: "Python (Stub)",
  rs: "Rust",
  json: "JSON",
  jsonc: "JSONC",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  md: "Markdown",
  mdx: "MDX",
  xml: "XML",
  svg: "SVG",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  sql: "SQL",
  sh: "Shell",
  bash: "Bash",
  zsh: "Shell",
  fish: "Fish",
  go: "Go",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin (Script)",
  c: "C",
  h: "C Header",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++ Header",
  cs: "C#",
  fs: "F#",
  fsx: "F# (Script)",
  swift: "Swift",
  rb: "Ruby",
  php: "PHP",
  lua: "Lua",
  r: "R",
  pl: "Perl",
  pm: "Perl Module",
  dart: "Dart",
  ex: "Elixir",
  exs: "Elixir (Script)",
  erl: "Erlang",
  hrl: "Erlang Header",
  hs: "Haskell",
  lhs: "Literate Haskell",
  ml: "OCaml",
  mli: "OCaml Interface",
  scala: "Scala",
  sc: "Scala (Worksheet)",
  clj: "Clojure",
  cljs: "ClojureScript",
  cljc: "Clojure (Common)",
  edn: "EDN",
  elm: "Elm",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
  graphql: "GraphQL",
  gql: "GraphQL",
  proto: "Protobuf",
  dockerfile: "Dockerfile",
  env: "Environment",
  gitignore: "Gitignore",
  properties: "Properties",
  cfg: "Config",
  conf: "Config",
  ini: "INI",
  makefile: "Makefile",
  cmake: "CMake",
  txt: "Plain Text",
  log: "Log",
  diff: "Diff",
  patch: "Patch",
};

function detectLanguage(path: string): string {
  // Handle special filenames (no extension)
  const basename = path.split("/").pop()?.split("\\").pop() ?? path;
  if (/^Dockerfile$/i.test(basename)) return "Dockerfile";
  if (/^Makefile$/i.test(basename)) return "Makefile";
  if (/^\.env/i.test(basename)) return "Environment";
  if (/^\.gitignore$/i.test(basename)) return "Gitignore";
  if (/^Cargo\.toml$/i.test(basename)) return "TOML";
  if (/^Cargo\.lock$/i.test(basename)) return "TOML";

  const dotIdx = basename.lastIndexOf(".");
  if (dotIdx === -1 || dotIdx === 0) return "Plain Text";

  const ext = basename.slice(dotIdx + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? ext.toUpperCase();
}

export function CodeViewer({ noteId, path }: CodeViewerProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const language = detectLanguage(path);

  const loadCode = useCallback(async () => {
    try {
      setError(null);
      let text: string;

      if (isTauri()) {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        text = await readTextFile(noteId);
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      }

      setCode(text);
    } catch (e: any) {
      console.error("Code load error:", e);
      setError(e?.message || "无法读取代码文件");
    }
  }, [noteId]);

  useEffect(() => {
    loadCode();
  }, [loadCode]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (code === null) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {language}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {code.split("\n").length} lines
        </span>
      </div>

      {/* Code block */}
      <pre className="flex-1 bg-zinc-950 text-zinc-100 p-4 overflow-auto font-mono text-sm m-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}
