import { BookOpen, Brain, FileText, History, Library, Loader2, MessageSquare, Mic, Play, Plus, Send, ShieldCheck, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  const activeRunning = busy || active?.status === "running";
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
      { id: "new", icon: Plus, label: "New research" },
      { id: "history", icon: History, label: "Research history" },
      { id: "conversations", icon: MessageSquare, label: "Conversations" },
      { id: "saved", icon: Library, label: "Saved research" },
      { id: "memory", icon: Brain, label: "Memory" }
    ] as const,
    []
  );

  function renderMain() {
    if (activeView === "history") {
      return (
        <ViewShell title="Research history" description="Review every run, reopen reports, and inspect failed attempts.">
          <ResearchList items={research} empty="No research runs yet." onOpen={(id) => void openResearch(id, "history")} />
          <ResultPanel active={active} />
        </ViewShell>
      );
    }

    if (activeView === "conversations") {
      return (
        <ViewShell title="Conversations" description="Research sessions created when you start a question.">
          <div className="stack-list">
            {conversations.length === 0 && <EmptyState>No conversations yet.</EmptyState>}
            {conversations.map((conversation) => (
              <div key={conversation.id} className="glass-card">
                <div className="inline-row">
                  <MessageSquare className="surface-icon" />
                  <div>
                    <h3 className="card-title">{conversation.title}</h3>
                    <p className="meta-text">Updated {formatDate(conversation.updated_at)}</p>
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
        <ViewShell title="Saved research" description="Completed reports ready to reopen with their sources and tool history.">
          <ResearchList items={completedResearch} empty="No completed reports yet." onOpen={(id) => void openResearch(id, "saved")} />
          <ResultPanel active={active} />
        </ViewShell>
      );
    }

    if (activeView === "memory") {
      return (
        <ViewShell title="Memory" description="Durable preferences and reusable project context stored by the agent.">
          <div className="stack-list">
            {memories.length === 0 && <EmptyState>No saved memories yet.</EmptyState>}
            {memories.map((memory) => (
              <div key={memory.id} className="glass-card">
                <div className="split-row">
                  <div>
                    <p className="body-text">{memory.content}</p>
                    <p className="meta-text">{memory.kind} - {formatDate(memory.created_at)}</p>
                  </div>
                  <button aria-label="Delete memory" className="icon-button danger-button" onClick={() => void deleteMemory(memory.id)}>
                    <Trash2 className="icon-sm" />
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
        <section className={`glass-panel prompt-panel ${activeRunning ? "is-descending" : ""}`}>
          <textarea className="prompt-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Research recent developments in RAG, compare PostgreSQL and MongoDB, or analyze a GitHub repository URL..." />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-action" disabled={busy} onClick={() => void startResearch()}>
            {busy ? <Loader2 className="icon-sm spin" /> : <Play className="icon-sm" />} Start research
          </button>
        </section>

        <section className={`glass-panel activity-panel ${activeRunning ? "is-rising" : ""}`}>
          <SectionTitle>Agent activity</SectionTitle>
          <div className="activity-list">
            {(events.length ? events : [{ message: "No active run selected.", createdAt: new Date().toISOString(), type: "research_started", researchId: "" } as ActivityEvent]).map((event, index) => (
              <div key={`${event.createdAt}-${index}`} className="activity-row" style={{ "--stagger": `${Math.min(index, 8) * 70}ms` } as CSSProperties}>
                <ActivityDot type={event.type} />
                <div>
                  <p className="body-text">{event.message}</p>
                  <p className="meta-text">{toEventLabel(event.type)}</p>
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
      <main className="auth-screen">
        <section className="glass-panel auth-panel">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">Z</span>
            <h1>Zentriq.ai</h1>
          </div>
          <input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          {error && <p className="error-text">{error}</p>}
          <div className="auth-actions">
            <button className="primary-action" onClick={() => void signIn("login")}>Log in</button>
            <button className="secondary-action" onClick={() => void signIn("register")}>Register</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <div className="top-dock" aria-label="Quick navigation">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button key={id} aria-label={label} onClick={() => selectNav(id)} className={`dock-item ${activeView === id ? "is-active" : ""}`}>
            <Icon className="icon-sm" />
          </button>
        ))}
      </div>

      <aside className="glass-rail sidebar-rail">
        <div className="brand-lockup"><span className="brand-mark" aria-label="Zentriq.ai logo mark">Z</span> <span>Zentriq.ai</span></div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => selectNav(id)} className={`nav-item ${activeView === id ? "is-active" : ""}`}>
              <Icon className="icon-sm" />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck className="icon-sm" />
          Real tools only. Missing providers surface as configuration errors.
        </div>
      </aside>

      <main className="main-stage">
        {renderMain()}
      </main>

      <aside className="glass-rail right-rail">
        <h2 className="rail-title"><BookOpen className="icon-sm" /> Research history</h2>
        <div className="history-list">
          {research.map((item) => (
            <button key={item.id} onClick={() => void loadDetails(item.id)} className="history-card">
              <span className="history-question">{item.question}</span>
              <StatusBadge status={item.status} />
            </button>
          ))}
        </div>
        <Panel title="Sources" items={sources.map((s) => ({ title: s.title, meta: s.source_type ?? s.sourceType ?? "source", href: s.url }))} />
        <Panel title="Tool calls" items={toolCalls.map((t) => ({ title: `${t.server}.${t.tool_name ?? t.toolName}`, meta: t.success ? `${t.duration_ms ?? 0} ms` : t.error ?? "failed" }))} />
        <Panel title="Memory" items={memories.map((m) => ({ title: m.content, meta: m.kind }))} />
      </aside>

      <div className="command-bar" aria-label="Research command status">
        <Mic className="command-icon" />
        <span>{activeRunning ? "Agent is descending through sources" : "Ready for the next research run"}</span>
        <button className="icon-button" aria-label="Start research from prompt" disabled={busy || !question.trim()} onClick={() => void startResearch()}>
          <Send className="icon-sm" />
        </button>
      </div>
    </div>
  );
}

function ViewShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="view-shell">
      <header className="view-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

function ResearchList({ items, empty, onOpen }: { items: ResearchRow[]; empty: string; onOpen: (id: string) => void }) {
  return (
    <div className="stack-list">
      {items.length === 0 && <EmptyState>{empty}</EmptyState>}
      {items.map((item) => (
        <button key={item.id} onClick={() => onOpen(item.id)} className="glass-card research-card">
          <FileText className="surface-icon" />
          <div>
            <h3 className="card-title">{item.question}</h3>
            <div className="badge-row">
              <StatusBadge status={item.status} />
              <span className="meta-text">{formatDate(item.created_at)}</span>
            </div>
            {item.error && <p className="error-text clamp-text">{item.error}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

function ResultPanel({ active }: { active?: ResearchRow }) {
  return (
    <section className="report-panel">
      <SectionTitle>Final report</SectionTitle>
      <div className="report-surface">
        {active?.report ? (
          <ReportView report={active.report} />
        ) : active?.error ? (
          <div>
            <h3 className="error-heading">Research failed</h3>
            <p className="error-text">{active.error}</p>
          </div>
        ) : (
          <p className="empty-copy">Completed reports will surface here.</p>
        )}
      </div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
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
    <article className="report-content">
      <h1>{report.title ?? "Research report"}</h1>
      {summary && <p>{summary}</p>}
      {!!findings?.length && (
        <div>
          <h3>Key findings</h3>
          <ul>{findings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {!!limitations?.length && <p className="report-note">Limitations: {limitations.join(" ")}</p>}
      {extraSections.map(([key, value]) => (
        <section key={key}>
          <h3>{toTitle(key)}</h3>
          <ReportValue value={value} />
        </section>
      ))}
    </article>
  );
}

function ReportValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>{formatValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="report-object">
        {Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
          <p key={key}>
            <span>{toTitle(key)}: </span>
            {formatValue(nested)}
          </p>
        ))}
      </div>
    );
  }
  return <p>{formatValue(value)}</p>;
}

function Panel({ title, items }: { title: string; items: Array<{ title: string; meta: string; href?: string }> }) {
  return (
    <section className="rail-section">
      <h3>{title}</h3>
      <div className="rail-list">
        {items.length === 0 && <p className="empty-copy">None yet.</p>}
        {items.map((item, index) => (
          <a key={`${item.title}-${index}`} href={item.href} target={item.href ? "_blank" : undefined} className="rail-card">
            <span>{item.title}</span>
            <small>{item.meta}</small>
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
    <section className={`runtime-strip ${ready ? "is-ready" : "needs-config"}`}>
      <span className="pulse-dot" aria-hidden="true" />
      <strong>{ready ? "Runtime ready" : "Provider configuration needed"}</strong>
      <span>
        {ready
          ? `Database, ${status.llm.provider}/${status.llm.model}, embeddings, and ${status.search.provider} search are configured.`
          : `Missing: ${[...new Set(blockers)].join(", ")}. The app will not fabricate research without these.`}
      </span>
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function ActivityDot({ type }: { type: ActivityEvent["type"] }) {
  const state = type.includes("failed") ? "fail" : type.includes("completed") || type.includes("generated") || type.includes("found") ? "done" : "running";
  return <span className={`activity-dot is-${state}`} aria-hidden="true" />;
}

function toEventLabel(value: string) {
  return value.replace(/_/g, " ");
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
