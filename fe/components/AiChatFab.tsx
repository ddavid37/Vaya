// Global floating ? AI chat — available on every screen with route-aware context.

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { screenContextFromLocation } from "@/lib/screen-context";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function AiChatFab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString()
    ? `?${searchParams.toString()}`
    : "";
  const context = screenContextFromLocation(pathname, search);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  // Reset thread lightly when navigating to a different screen (keep panel open).
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [pathname]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(0, -1),
          context,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "No reply." },
      ]);
    } catch {
      setError("Could not reach AI chat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-5 bottom-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-orange font-sans text-xl font-bold text-white shadow-md transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange md:right-8 md:bottom-8"
        aria-label={open ? "Close AI help chat" : "Open AI help chat"}
        aria-expanded={open}
      >
        ?
      </button>

      {open ? (
        <div
          className="fixed right-5 bottom-20 z-50 flex w-[min(100vw-2.5rem,22rem)] flex-col overflow-hidden border border-rule bg-white shadow-lg md:right-8 md:bottom-24"
          role="dialog"
          aria-label="AI help chat"
        >
          <div className="flex items-start justify-between gap-2 border-b border-rule px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-[0.6rem] tracking-[0.14em] text-orange uppercase">
                Ask Vaya AI
              </p>
              <p className="mt-0.5 truncate font-mono text-[0.65rem] text-mid">
                {context.part} · {context.screen}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-mono text-[0.65rem] tracking-[0.12em] text-mid uppercase hover:text-orange"
            >
              Close
            </button>
          </div>

          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="text-[0.8rem] leading-relaxed text-muted">
                Ask about this screen — e.g. why a COMPLETE trip is red, what
                IMEI means, or how trusted miles work.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "user"
                    ? "ml-6 border border-orange/40 bg-orange/5 px-2.5 py-2 text-[0.8rem] leading-relaxed text-ink"
                    : "mr-4 border border-rule px-2.5 py-2 text-[0.8rem] leading-relaxed text-ink"
                }
              >
                <p className="mb-1 font-mono text-[0.55rem] tracking-[0.12em] text-mid uppercase">
                  {m.role === "user" ? "You" : "AI"}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {loading ? (
              <p className="font-mono text-[0.65rem] text-muted">Thinking…</p>
            ) : null}
            {error ? <p className="text-[0.8rem] text-orange">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={send}
            className="flex gap-2 border-t border-rule p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="min-w-0 flex-1 border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.12em] text-white uppercase hover:opacity-80 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
