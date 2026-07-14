import { useState, useRef } from "react";
import { FaArrowLeft, FaArrowRight, FaRotateRight, FaMagnifyingGlass } from "react-icons/fa6";

export function BrowserPanel() {
  const [url, setUrl] = useState("about:blank");
  const [inputUrl, setInputUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigate = () => {
    let u = inputUrl.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    setUrl(u);
  };

  const goBack = () => iframeRef.current?.contentWindow?.history.back();
  const goForward = () => iframeRef.current?.contentWindow?.history.forward();
  const reload = () => { if (iframeRef.current) iframeRef.current.src = url; };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 animate-slide-in-right">
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-1 px-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <button onClick={goBack} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500" title="后退">
          <FaArrowLeft size={12} />
        </button>
        <button onClick={goForward} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500" title="前进">
          <FaArrowRight size={12} />
        </button>
        <button onClick={reload} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500" title="刷新">
          <FaRotateRight size={12} />
        </button>
        <form
          onSubmit={(e) => { e.preventDefault(); navigate(); }}
          className="flex-1 flex items-center"
        >
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-full h-6 px-2 text-[11px] rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-accent"
            placeholder="输入网址..."
          />
        </form>
        <button onClick={navigate} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500" title="转到">
          <FaMagnifyingGlass size={12} />
        </button>
      </div>
      {/* WebView area */}
      <iframe ref={iframeRef} src={url} className="flex-1 w-full border-none" title="Browser"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" />
    </div>
  );
}
