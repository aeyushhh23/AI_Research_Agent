import { BookOpen, Brain, History, KeyRound, Library, Loader2, MessageSquare, Play, Plus, Search, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActivityEvent } from "@ai-research-agent/shared";
import { api, auth, researchStreamUrl, type AuthState } from "../api/client.js";

type ResearchRow = { id: string; question: string; status: string; report?: Report; error?: string; created_at: string };
type Report = { title?: string; summary?: string; keyFindings?: string[]; limitations?: string[]; sources?: Source[] };
type Source = { id?: string; title: string; url: string; source_type?: string; sourceType?: string; summary?: string };
type ToolCall = { id: string; server: string; tool_name: string; toolName?: string; success: boolean; error?: string; duration_ms?: number };
type Memory = { id: string; content: string; kind: string; created_at: string };

export function App() {
  const [authState, setAuthState] = useState<AuthState | null>(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    return token && email ? { token, user: { id: "", email } } : null;
  });
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [research, setResearch] = useState<ResearchRow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = research.find((item) => item.id === activeId);

  useEffect(() => {
    if (!authState) return;
    void refresh();
  }, [authState]);

  useEffect(() => {
    if (!activeId || !authState) return;
    const stream = new EventSource(researchStreamUrl(activeId));
    stream.onmessage = (event) => setEvents((prev) => prev.concat(JSON.parse(event.data)));
    const eventTypes = ["research_started", "planning_started", "tool_started", "tool_completed", "source_found", "memory_retrieved", "analysis_started", "report_generated", "research_completed", "research_failed"];
    eventTypes.forEach((type) => {
      stream.addEventListener(type, (event) => setEvents((prev) => prev.concat(JSON.parse((event as MessageEvent).data))));
    });
    return () => stream.close();
  }, [activeId, authState]);

  async function refresh() {
    const [researchData, memoryData] = await Promise.all([
      api<{ research: ResearchRow[] }>("/api/research"),
      api<{ memories: Memory[] }>("/api/memories")
    ]);
    setResearch(researchData.research);
    setMemories(memoryData.memories);
  }

  async function loadDetails(id: string) {
    setActiveId(id);
    const [sourceData, toolData] = await Promise.all([
      api<{ sources: Source[] }>(`/api/research/${id}/sources`),
      api<{ toolCalls: ToolCall[] }>(`/api/research/${id}/tool-calls`)
    ]);
    setSources(sourceData.sources);
    setToolCalls(toolData.toolCalls);
  }

  async function signIn(mode: "login" | "register") {
    setError(null);
    try {
      const state = mode === "login" ? await auth.login(email, password) : await auth.register(email, password);
      localStorage.setItem("token", state.token);
      localStorage.setItem("email", state.user.email);
      setAuthState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  }

  async function startResearch() {
    if (!question.trim()) return;
    setBusy(true);
    setEvents([]);
    setError(null);
    try {
      const result = await api<{ researchId: string }>("/api/research", {
        method: "POST",
        body: JSON.stringify({ question })
      });
      setActiveId(result.researchId);
      setQuestion("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start research.");
    } finally {
      setBusy(false);
    }
  }

  const navItems = useMemo(
    () => [
      [Plus, "New Research"],
      [History, "Research History"],
      [MessageSquare, "Conversations"],
      [Library, "Saved Research"],
      [Brain, "Memory"]
    ] as const,
    []
  );

  if (!authState) {
    return (
      <main className="grid min-h-full place-items-center bg-mist px-4">
        <section className="w-full max-w-sm rounded border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-semibold">AI Research Agent</h1>
          </div>
          <input className="mb-3 w-full rounded border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="mb-3 w-full rounded border border-slate-300 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          {error && <p className="mb-3 text-sm text-signal">{error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 rounded bg-accent px-3 py-2 text-white" onClick={() => void signIn("login")}>Log in</button>
            <button className="flex-1 rounded border border-slate-300 px-3 py-2" onClick={() => void signIn("register")}>Register</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="grid h-full grid-cols-[230px_minmax(0,1fr)_330px] overflow-hidden">
      <aside className="border-r border-slate-200 bg-white p-4">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold"><Search className="h-5 w-5 text-accent" /> AI Research</div>
        <nav className="space-y-1">
          {navItems.map(([Icon, label]) => (
            <button key={label} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-mist"><Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>
        <div className="mt-8 text-xs text-slate-500">
          <ShieldCheck className="mb-2 h-4 w-4 text-accent" />
          Real tools only. Missing providers surface as configuration errors.
        </div>
      </aside>

      <main className="overflow-y-auto p-6">
        <section className="mb-5">
          <textarea className="h-28 w-full resize-none rounded border border-slate-300 bg-white p-4 outline-accent" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Research recent developments in RAG, compare PostgreSQL and MongoDB, or analyze a GitHub repository URL..." />
          {error && <p className="mt-2 text-sm text-signal">{error}</p>}
          <button className="mt-3 inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-white disabled:opacity-60" disabled={busy} onClick={() => void startResearch()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start research
          </button>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent Activity</h2>
          <div className="rounded border border-slate-200 bg-white">
            {(events.length ? events : [{ message: "No active run selected.", createdAt: new Date().toISOString(), type: "research_started", researchId: "" } as ActivityEvent]).map((event, index) => (
              <div key={`${event.createdAt}-${index}`} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <Wrench className="mt-0.5 h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm">{event.message}</p>
                  <p className="text-xs text-slate-500">{event.type}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Final Report</h2>
          <div className="rounded border border-slate-200 bg-white p-5">
            {active?.report ? <ReportView report={active.report} /> : <p className="text-sm text-slate-500">Completed reports appear here.</p>}
            {active?.error && <p className="mt-3 text-sm text-signal">{active.error}</p>}
          </div>
        </section>
      </main>

      <aside className="overflow-y-auto border-l border-slate-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-accent" /> Research History</h2>
        <div className="mb-6 space-y-2">
          {research.map((item) => (
            <button key={item.id} onClick={() => void loadDetails(item.id)} className="w-full rounded border border-slate-200 p-3 text-left text-sm hover:border-accent">
              <span className="line-clamp-2 block">{item.question}</span>
              <span className="mt-1 block text-xs text-slate-500">{item.status}</span>
            </button>
          ))}
        </div>
        <Panel title="Sources" items={sources.map((s) => ({ title: s.title, meta: s.source_type ?? s.sourceType ?? "source", href: s.url }))} />
        <Panel title="Tool Calls" items={toolCalls.map((t) => ({ title: `${t.server}.${t.tool_name ?? t.toolName}`, meta: t.success ? `${t.duration_ms ?? 0} ms` : t.error ?? "failed" }))} />
        <Panel title="Memory" items={memories.map((m) => ({ title: m.content, meta: m.kind }))} />
      </aside>
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  return (
    <article className="space-y-4">
      <h1 className="text-xl font-semibold">{report.title ?? "Research Report"}</h1>
      <p className="text-sm leading-6 text-slate-700">{report.summary}</p>
      <div>
        <h3 className="mb-2 font-semibold">Key findings</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">{report.keyFindings?.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      {!!report.limitations?.length && <p className="text-sm text-slate-500">Limitations: {report.limitations.join(" ")}</p>}
    </article>
  );
}

function Panel({ title, items }: { title: string; items: Array<{ title: string; meta: string; href?: string }> }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
        {items.map((item, index) => (
          <a key={`${item.title}-${index}`} href={item.href} target={item.href ? "_blank" : undefined} className="block rounded border border-slate-200 p-3 text-sm hover:border-accent">
            <span className="line-clamp-2 block">{item.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{item.meta}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
