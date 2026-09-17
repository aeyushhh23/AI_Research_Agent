import { BookOpen, Brain, FileText, History, KeyRound, Library, Loader2, MessageSquare, Play, Plus, Search, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ActivityEvent } from "@ai-research-agent/shared";
import { api, auth, researchStreamUrl, type AuthState } from "../api/client.js";

type ResearchRow = { id: string; question: string; status: string; report?: Report; error?: string; created_at: string };
type ViewId = "new" | "history" | "conversations" | "saved" | "memory";
type Report = {
  title?: string;
  summary?: string;
  executive_summary?: string;
  overview?: string;
  description?: string;
  keyFindings?: string[];
  top_trends?: Array<{ trend?: string; description?: string; sources?: string[] }>;
  use_cases?: string[];
  limitations?: unknown;
  sources?: Source[];
  [key: string]: unknown;
};
type Source = { id?: string; title: string; url: string; source_type?: string; sourceType?: string; summary?: string };
type ToolCall = { id: string; server: string; tool_name: string; toolName?: string; success: boolean; error?: string; duration_ms?: number };
type Memory = { id: string; content: string; kind: string; created_at: string };
type Conversation = { id: string; title: string; created_at: string; updated_at: string };
type RuntimeStatus = {
  database: { ok: boolean; error?: string };
  llm: { configured: boolean; missing: string[]; provider: string; model: string };
  embeddings: { configured: boolean; missing: string[]; provider: string; model: string };
  search: { configured: boolean; missing: string[]; provider: string };
  github: { configured: boolean; optional: true };
};

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
  const [activeView, setActiveView] = useState<ViewId>("new");
  const [research, setResearch] = useState<ResearchRow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = research.find((item) => item.id === activeId);
  const completedResearch = research.filter((item) => item.status === "completed" && item.report);

  useEffect(() => {
    void loadRuntimeStatus();
    if (authState) void refresh();
  }, [authState]);

  useEffect(() => {
    if (!activeId || !authState) return;
    const stream = new EventSource(researchStreamUrl(activeId));
    const handleEvent = (event: MessageEvent) => {
      const parsed = JSON.parse(event.data) as ActivityEvent;
      setEvents((prev) => prev.concat(parsed));
      if (["report_generated", "research_completed", "research_failed"].includes(parsed.type)) {
        void refresh();
        void loadDetails(activeId);
      }
    };
    stream.onmessage = handleEvent;
    const eventTypes = ["research_started", "planning_started", "tool_started", "tool_completed", "source_found", "memory_retrieved", "analysis_started", "report_generated", "research_completed", "research_failed"];
    eventTypes.forEach((type) => {
      stream.addEventListener(type, (event) => handleEvent(event as MessageEvent));
    });
    return () => stream.close();
  }, [activeId, authState]);

  async function refresh() {
    const [researchData, memoryData, conversationData] = await Promise.all([
      api<{ research: ResearchRow[] }>("/api/research"),
      api<{ memories: Memory[] }>("/api/memories"),
      api<{ conversations: Conversation[] }>("/api/conversations")
    ]);
    setResearch(researchData.research);
    setMemories(memoryData.memories);
    setConversations(conversationData.conversations);
    if (!activeId) {
      const latestCompleted = researchData.research.find((item) => item.status === "completed" && item.report);
      if (latestCompleted) void loadDetails(latestCompleted.id);
    }
  }

  async function loadRuntimeStatus() {
    const data = await api<{ status: RuntimeStatus }>("/api/config/status");
    setRuntimeStatus(data.status);
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

  async function openResearch(id: string, view: ViewId = activeView) {
    setActiveView(view);
    setEvents([]);
    await loadDetails(id);
  }

  async function deleteMemory(id: string) {
    await api(`/api/memories/${id}`, { method: "DELETE" });
    await refresh();
  }

  function selectNav(view: ViewId) {
    setActiveView(view);
    setError(null);
    if (view === "new") {
      setActiveId(null);
      setSources([]);
      setToolCalls([]);
      setEvents([]);
      setQuestion("");
    } else {
      void refresh();
    }
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
      setActiveView("new");
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
      { id: "new", icon: Plus, label: "New Research" },
      { id: "history", icon: History, label: "Research History" },
      { id: "conversations", icon: MessageSquare, label: "Conversations" },
      { id: "saved", icon: Library, label: "Saved Research" },
      { id: "memory", icon: Brain, label: "Memory" }
    ] as const,
    []
  );

  function renderMain() {
    if (activeView === "history") {
      return (
        <ViewShell title="Research History" description="Review every run, reopen reports, and inspect failed attempts.">
          <ResearchList items={research} empty="No research runs yet." onOpen={(id) => void openResearch(id, "history")} />
          <ResultPanel active={active} />
        </ViewShell>
      );
    }

    if (activeView === "conversations") {
      return (
        <ViewShell title="Conversations" description="Research sessions created when you start a question.">
          <div className="grid gap-3">
            {conversations.length === 0 && <EmptyState>No conversations yet.</EmptyState>}
            {conversations.map((conversation) => (
              <div key={conversation.id} className="rounded border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-1 h-4 w-4 text-accent" />
                  <div>
                    <h3 className="font-medium">{conversation.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Updated {formatDate(conversation.updated_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ViewShell>
      );
    }

    if (activeView === "saved") {
      return (
        <ViewShell title="Saved Research" description="Completed reports ready to reopen with their sources and tool history.">
          <ResearchList items={completedResearch} empty="No completed reports yet." onOpen={(id) => void openResearch(id, "saved")} />
          <ResultPanel active={active} />
        </ViewShell>
      );
    }

    if (activeView === "memory") {
      return (
        <ViewShell title="Memory" description="Durable preferences and reusable project context stored by the agent.">
          <div className="grid gap-3">
            {memories.length === 0 && <EmptyState>No saved memories yet.</EmptyState>}
            {memories.map((memory) => (
              <div key={memory.id} className="rounded border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm leading-6">{memory.content}</p>
                    <p className="mt-2 text-xs text-slate-500">{memory.kind} - {formatDate(memory.created_at)}</p>
                  </div>
                  <button aria-label="Delete memory" className="rounded p-2 text-slate-500 hover:bg-mist hover:text-signal" onClick={() => void deleteMemory(memory.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ViewShell>
      );
    }

    return (
      <>
        {runtimeStatus && <RuntimeStatusStrip status={runtimeStatus} />}
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

        <ResultPanel active={active} />
      </>
    );
  }

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
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => selectNav(id)} className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${activeView === id ? "bg-mist text-accent" : "hover:bg-mist"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        <div className="mt-8 text-xs text-slate-500">
          <ShieldCheck className="mb-2 h-4 w-4 text-accent" />
          Real tools only. Missing providers surface as configuration errors.
        </div>
      </aside>

      <main className="overflow-y-auto p-6">
        {renderMain()}
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

function ViewShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <header className="mb-5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </header>
      {children}
    </section>
  );
}

function ResearchList({ items, empty, onOpen }: { items: ResearchRow[]; empty: string; onOpen: (id: string) => void }) {
  return (
    <div className="mb-6 grid gap-3">
      {items.length === 0 && <EmptyState>{empty}</EmptyState>}
      {items.map((item) => (
        <button key={item.id} onClick={() => onOpen(item.id)} className="rounded border border-slate-200 bg-white p-4 text-left hover:border-accent">
          <div className="flex items-start gap-3">
            <FileText className="mt-1 h-4 w-4 text-accent" />
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-medium">{item.question}</h3>
              <p className="mt-1 text-xs text-slate-500">{item.status} - {formatDate(item.created_at)}</p>
              {item.error && <p className="mt-2 line-clamp-2 text-xs text-signal">{item.error}</p>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ResultPanel({ active }: { active?: ResearchRow }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Final Report</h2>
      <div className="rounded border border-slate-200 bg-white p-5">
        {active?.report ? (
          <ReportView report={active.report} />
        ) : active?.error ? (
          <div>
            <h3 className="font-semibold text-signal">Research failed</h3>
            <p className="mt-2 text-sm leading-6 text-signal">{active.error}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Completed reports appear here.</p>
        )}
      </div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">{children}</div>;
}

function ReportView({ report }: { report: Report }) {
  const summary = report.summary ?? report.executive_summary ?? report.overview ?? report.description;
  const findings =
    report.keyFindings ??
    (Array.isArray(report.top_trends) ? report.top_trends.map((trend) => `${trend.trend ?? "Trend"}: ${trend.description ?? ""}`) : undefined) ??
    (Array.isArray(report.use_cases) ? report.use_cases : undefined);
  const limitations = Array.isArray(report.limitations)
    ? report.limitations.map((item) => (typeof item === "string" ? item : formatValue(item)))
    : report.limitations
      ? [formatValue(report.limitations)]
      : undefined;
  const renderedKeys = new Set([
    "title",
    "summary",
    "executive_summary",
    "overview",
    "description",
    "keyFindings",
    "top_trends",
    "use_cases",
    "limitations",
    "sources"
  ]);
  const extraSections = Object.entries(report).filter(([key, value]) => !renderedKeys.has(key) && value != null);
  return (
    <article className="space-y-4">
      <h1 className="text-xl font-semibold">{report.title ?? "Research Report"}</h1>
      {summary && <p className="text-sm leading-6 text-slate-700">{summary}</p>}
      {!!findings?.length && (
        <div>
          <h3 className="mb-2 font-semibold">Key findings</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{findings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {!!limitations?.length && <p className="text-sm text-slate-500">Limitations: {limitations.join(" ")}</p>}
      {extraSections.map(([key, value]) => (
        <section key={key}>
          <h3 className="mb-2 font-semibold">{toTitle(key)}</h3>
          <ReportValue value={value} />
        </section>
      ))}
    </article>
  );
}

function ReportValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {value.map((item, index) => (
          <li key={index}>{formatValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="space-y-2 text-sm">
        {Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
          <p key={key}>
            <span className="font-medium">{toTitle(key)}: </span>
            <span>{formatValue(nested)}</span>
          </p>
        ))}
      </div>
    );
  }
  return <p className="text-sm leading-6 text-slate-700">{formatValue(value)}</p>;
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${toTitle(key)}: ${formatValue(nested)}`)
      .join("; ");
  }
  return String(value);
}

function toTitle(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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

function RuntimeStatusStrip({ status }: { status: RuntimeStatus }) {
  const blockers = [
    ...(status.database.ok ? [] : ["Database unavailable"]),
    ...status.llm.missing,
    ...status.embeddings.missing.filter((item) => !status.llm.missing.includes(item)),
    ...status.search.missing
  ];
  const ready = blockers.length === 0;
  return (
    <section className={`mb-5 rounded border px-4 py-3 text-sm ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      <strong>{ready ? "Runtime ready" : "Provider configuration needed"}</strong>
      <span className="ml-2">
        {ready
          ? `Database, ${status.llm.provider}/${status.llm.model}, embeddings, and ${status.search.provider} search are configured.`
          : `Missing: ${[...new Set(blockers)].join(", ")}. The app will not fabricate research without these.`}
      </span>
    </section>
  );
}
