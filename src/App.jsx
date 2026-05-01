import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const RECOMMENDATION_LABEL = {
  workflow: 'Use workflow',
  simple_prompt: 'Use simple prompt',
  agent: 'Use agent',
  skill: 'Use skill',
};

const TRADEOFF_METRICS = {
  workflow: {
    tokens: '3,500 - 5,000',
    dailyPercent: '~14%',
  },
  simple_prompt: {
    tokens: '700 - 1,000',
    dailyPercent: '~3%',
  },
};

const WORKFLOWS_STORAGE_KEY = 'compass_workflows';
const PINNED_STORAGE_KEY = 'compass_pinned';
const MESSAGE_FEEDBACK_KEY = 'compass_message_feedback';

const enforceMarkdownBullets = (content) => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const normalized = content.replace(/\r/g, '').trim();
  if (!normalized) {
    return normalized;
  }

  const hasBullets = /^\s*[-*]\s+/m.test(normalized);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const output = [];

  if (hasBullets) {
    for (const line of lines) {
      if (/^summary:?$/i.test(line)) {
        output.push('## Summary');
      } else if (/^key details:?$/i.test(line)) {
        output.push('## Key details');
      } else {
        output.push(line);
      }
    }
    return output.join('\n');
  }

  for (const line of lines) {
    if (/^summary:?$/i.test(line)) {
      output.push('## Summary');
      continue;
    }

    if (/^key details:?$/i.test(line)) {
      output.push('## Key details');
      continue;
    }

    if (line.endsWith(':')) {
      output.push(`### ${line.replace(/:$/, '')}`);
      continue;
    }

    output.push(`- ${line}`);
  }

  return output.join('\n');
};

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c96442]/30 border-t-[#c96442]" />
  );
}

function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

const buildWorkflowTitle = (prompt) => {
  const trimmed = (prompt || '').trim().slice(0, 60);
  if (!trimmed) return 'Untitled workflow';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const getDefaultWorkflowName = (prompt) => {
  const trimmed = (prompt || '').trim().slice(0, 40);
  if (!trimmed) return 'Untitled workflow';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggle,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  onNewChat,
  onShowWorkflows,
  onShowArtifacts,
  workflowCount,
  pinnedWorkflows,
  recentWorkflows,
  onSelectWorkflow,
  onTogglePin,
}) {
  const navTabs = [
    { id: 'chat', label: 'Chat', icon: '💬', active: true },
    { id: 'cowork', label: 'Cowork', icon: '⚙️', active: false },
    { id: 'code', label: 'Code', icon: '</>', active: false },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen overflow-y-auto border-r border-[#e8e6df] bg-[#f5f4ef] transition-all duration-300 ${
        collapsed ? 'md:w-12' : 'md:w-[260px]'
      } w-[85vw] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex h-full flex-col p-2">
        <div className={`mb-2 flex ${collapsed ? 'flex-col gap-1' : 'items-center gap-1'}`}>
          <button
            type="button"
            onClick={onToggle}
            className="h-8 w-8 rounded-md text-[#6b6860] hover:bg-[#ece9e1]"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={onToggleSearch}
            className="h-8 w-8 rounded-md text-[#6b6860] hover:bg-[#ece9e1]"
            title="Search"
          >
            ⌕
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto h-8 w-8 rounded-md text-[#6b6860] hover:bg-[#ece9e1] md:hidden"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>

        {(!collapsed || mobileOpen) && (
          <>
            {searchOpen && (
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search workflows..."
                className="mb-2 w-full rounded-lg border border-[#d7d4cb] bg-white px-2 py-1.5 text-sm text-[#1a1917] outline-none focus:border-[#c96442]"
              />
            )}
            <div className="mb-3 flex rounded-xl bg-[#ece9e1] p-1">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium ${
                    tab.active ? 'bg-white text-[#1a1917] shadow-sm' : 'text-[#6b6860]'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={onNewChat}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
              >
                <span className="text-sm text-[#6b6860]">+</span>
                <span>+ New chat</span>
              </button>
              <button
                type="button"
                onClick={onShowWorkflows}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
              >
                <span className="text-sm text-[#6b6860]">🗂</span>
                <span>Workflows</span>
                <span className="ml-auto rounded-full bg-[#e8e6df] px-2 py-0.5 text-[10px] font-semibold text-[#6b6860]">
                  {workflowCount}
                </span>
              </button>
              <button
                type="button"
                onClick={onShowArtifacts}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
              >
                <span className="text-sm text-[#6b6860]">⚖️</span>
                <span>Artifacts</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
              >
                <span className="text-sm text-[#6b6860]">💼</span>
                <span>Customize</span>
              </button>
            </div>

            <div className="mt-4">
              <p className="px-2 text-xs font-medium text-[#6b6860]">Pinned</p>
              {pinnedWorkflows.length === 0 ? (
                <p className="px-2 pt-2 text-xs italic text-[#9a968d]">Drag to pin</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {pinnedWorkflows.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectWorkflow(item.id)}
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
                      title={item.title}
                    >
                      <span className="truncate">{item.title}</span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePin(item.id);
                        }}
                        className="ml-auto text-xs text-[#6b6860] opacity-0 transition group-hover:opacity-100"
                        title="Unpin"
                      >
                        📌
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <p className="px-2 text-xs font-medium text-[#6b6860]">Recents</p>
              <div className="mt-1 space-y-0.5">
                {recentWorkflows.length === 0 && (
                  <p className="px-2 text-xs text-[#9a968d]">No recent workflows</p>
                )}
                {recentWorkflows.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectWorkflow(item.id)}
                    className="group relative flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-[#1a1917] hover:bg-[#ece9e1]"
                    title={item.title}
                  >
                    <span className="truncate">{item.title}</span>
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePin(item.id);
                      }}
                      className="ml-auto text-xs text-[#6b6860] opacity-0 transition group-hover:opacity-100"
                      title="Pin"
                    >
                      📌
                    </span>
                    <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden w-52 rounded-md border border-[#e2e0d8] bg-white p-2 text-xs text-[#6b6860] shadow-sm group-hover:block">
                      {(item.steps || []).length > 0 ? (
                        <div className="space-y-1">
                          {(item.steps || []).map((step, index) => (
                            <p key={`${item.id}-tip-${index}`}>{index + 1}. {step.name}</p>
                          ))}
                        </div>
                      ) : (
                        <p>No steps saved</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto space-y-2 px-1 pb-1">
              <div className="rounded-xl border border-[#e2e0d8] bg-white p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#1a1917]">🍃 Relaunch to update</p>
                    <p className="text-[10px] text-[#6b6860]">v1.5354.0</p>
                  </div>
                  <span className="text-[#6b6860]">→</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d97757] text-xs font-semibold text-white">
                    A
                  </div>
                  <span className="text-sm text-[#1a1917]">Aakansha</span>
                </div>
                <button type="button" className="text-[#6b6860]" title="Download">
                  ⤓
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function CompassPanel({
  status,
  classification,
  onChooseAction,
  onDismiss,
  tradeoffOpen,
  onConfirm,
  educationExpanded,
  onToggleEducationExpanded,
}) {
  const visible = status !== 'idle';
  const primaryIsWorkflow = classification?.recommendation !== 'simple_prompt';
  const showEducationBlock = !tradeoffOpen;

  return (
    <section
      className={`w-full overflow-y-auto overscroll-contain rounded-2xl border border-[#c96442] bg-[#ffffff] shadow-xl transition-all duration-500 ${
        visible
          ? `mt-3 translate-y-0 opacity-100 ${tradeoffOpen ? 'max-h-[70vh]' : 'max-h-[360px]'}`
          : 'pointer-events-none -mt-1 translate-y-3 opacity-0 max-h-0'
      }`}
    >
      <div className="border-b border-[#c96442]/20 bg-[#fdf0eb] px-5 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#c96442]" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M15.6 8.4l-2.2 6.2-6.2 2.2 2.2-6.2 6.2-2.2z" fill="currentColor" stroke="none" />
          </svg>
          <p className="text-sm font-semibold text-[#1a1917]">Claude Compass</p>
        </div>
      </div>

      <div className="p-4">
        {status === 'classifying' && (
          <div className="flex items-center gap-3 text-sm text-[#6b6860]">
            <Spinner />
            <p>Analysing your request...</p>
          </div>
        )}

        {classification && (
          <div className="space-y-4">
            {!tradeoffOpen && (
              <div>
                <p className="text-sm text-[#6b6860]">{classification.reason}</p>
                {showEducationBlock && (
                  <div className="mt-3 border-t border-[#e8e6df] pt-3">
                    <div className="rounded-lg border border-[#e2e0d8] bg-[#f7f5f0] p-2.5">
                      <p className="text-xs leading-relaxed text-[#6b6860]">
                        💡 A workflow breaks your task into steps, executes each one, and builds on the previous - giving
                        you more structured, reliable output than a single prompt.
                      </p>
                      <button
                        type="button"
                        onClick={onToggleEducationExpanded}
                        className="mt-2 text-xs font-medium text-[#c96442] hover:underline"
                      >
                        {educationExpanded ? 'Got it ↑' : "What's the difference? ↓"}
                      </button>
                    </div>
                    {educationExpanded && (
                      <div className="mt-2 rounded-lg border border-[#e2e0d8] bg-[#f7f5f0] p-2 text-xs leading-relaxed text-[#6b6860]">
                        <p><span className="font-semibold text-[#1a1917]">Simple prompt:</span> One generation, one shot. Fast but shallow. Best for questions, quick tasks, and lookups.</p>
                        <p className="mt-1"><span className="font-semibold text-[#1a1917]">Workflow:</span> Multi-step execution. Each step researches, reasons, or synthesises before passing output to the next. Best for reports, analysis, research, and anything that needs structure.</p>
                        <p className="mt-1"><span className="font-semibold text-[#1a1917]">When to use workflow:</span> Task has 3+ sequential steps, you want repeatable output, or you need depth over speed.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!tradeoffOpen && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => onChooseAction('workflow')}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${
                    primaryIsWorkflow
                      ? 'bg-[#c96442] text-white hover:bg-[#b85736]'
                      : 'border border-[#c96442]/35 bg-white text-[#c96442] hover:bg-[#fdf0eb]'
                  }`}
                >
                  Use workflow
                </button>
                <button
                  type="button"
                  onClick={() => onChooseAction('simple_prompt')}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${
                    primaryIsWorkflow
                      ? 'border border-[#c96442]/35 bg-white text-[#c96442] hover:bg-[#fdf0eb]'
                      : 'bg-[#c96442] text-white hover:bg-[#b85736]'
                  }`}
                >
                  Use simple prompt
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full rounded-lg border border-[#d7d4cb] px-2 py-2 text-sm font-medium text-[#6b6860] transition hover:text-[#1a1917] sm:w-auto sm:border-transparent"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div
              className={`grid overflow-hidden transition-all duration-300 ease-out ${tradeoffOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="min-h-0">
                <div className="rounded-xl border border-[#e2e0d8] bg-[#ffffff] p-4">
                  <div className="pr-1">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-[#c96442]/35 bg-[#fdf0eb] p-4 text-sm text-[#1a1917]">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-semibold text-[#1a1917]">Workflow</p>
                          <span className="rounded-full bg-[#c96442] px-2 py-0.5 text-xs font-semibold text-white">Recommended</span>
                        </div>
                        <p className="text-xs text-[#6b6860]">Tokens</p>
                        <p>{TRADEOFF_METRICS.workflow.tokens}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">% of daily limit</p>
                        <p>{TRADEOFF_METRICS.workflow.dailyPercent}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Time estimate</p>
                        <p>{classification.time_estimate}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Quality</p>
                        <p>{classification.quality}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Repeatable</p>
                        <p>{classification.repeatable ? 'Yes' : 'No'}</p>
                      </div>

                      <div className="rounded-xl border border-[#e2e0d8] bg-white p-4 text-sm text-[#1a1917]">
                        <p className="mb-2 font-semibold text-[#1a1917]">Simple prompt</p>
                        <p className="text-xs text-[#6b6860]">Tokens</p>
                        <p>{TRADEOFF_METRICS.simple_prompt.tokens}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">% of daily limit</p>
                        <p>{TRADEOFF_METRICS.simple_prompt.dailyPercent}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Time estimate</p>
                        <p>{classification.time_estimate}</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Quality</p>
                        <p>Fast draft quality</p>
                        <p className="mt-2 text-xs text-[#6b6860]">Repeatable</p>
                        <p>No</p>
                      </div>
                    </div>

                    {classification.steps.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs text-[#6b6860]">Workflow steps</p>
                        <div className="flex flex-wrap gap-2">
                          {classification.steps.map((step) => (
                            <span key={step} className="rounded-full border border-[#c96442]/30 bg-white px-3 py-1 text-xs text-[#c96442]">
                              {step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 mt-4 flex flex-col gap-2 border-t border-[#e8e6df] bg-[#ffffff] pt-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => onConfirm('workflow')}
                      className="w-full rounded-lg bg-[#c96442] px-4 py-2 text-sm font-medium text-white hover:bg-[#b85736] sm:w-auto"
                    >
                      Use workflow
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirm('simple_prompt')}
                      className="w-full rounded-lg border border-[#c96442]/35 bg-white px-4 py-2 text-sm font-medium text-[#c96442] transition hover:bg-[#fdf0eb] sm:w-auto"
                    >
                      Use simple prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [pinnedWorkflowIds, setPinnedWorkflowIds] = useState([]);
  const [activeView, setActiveView] = useState('chat');
  const [selectedArtifactId, setSelectedArtifactId] = useState(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [expandedWorkflowCards, setExpandedWorkflowCards] = useState({});
  const [pendingWorkflowSave, setPendingWorkflowSave] = useState(null);
  const [reuseDraft, setReuseDraft] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [educationExpanded, setEducationExpanded] = useState(false);
  const [status, setStatus] = useState('idle');
  const [classification, setClassification] = useState(null);
  const [tradeoffOpen, setTradeoffOpen] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState(null);
  const [simpleState, setSimpleState] = useState({ running: false });
  const [expandedWorkflowToggles, setExpandedWorkflowToggles] = useState({});
  const [inlineError, setInlineError] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [feedbackByMessageId, setFeedbackByMessageId] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const canSend = input.trim().length > 0 && status !== 'classifying' && !workflowRunning && !simpleState.running;
  const isApiLoading = status === 'classifying' || workflowRunning || simpleState.running;

  const assistantMessage = useMemo(
    () => messages.findLast((m) => m.role === 'assistant' && m.streaming),
    [messages]
  );

  useEffect(() => {
    try {
      const workflowsRaw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
      const pinnedRaw = localStorage.getItem(PINNED_STORAGE_KEY);
      const feedbackRaw = localStorage.getItem(MESSAGE_FEEDBACK_KEY);
      const parsedWorkflows = workflowsRaw ? JSON.parse(workflowsRaw) : [];
      const parsedPinned = pinnedRaw ? JSON.parse(pinnedRaw) : [];
      const parsedFeedback = feedbackRaw ? JSON.parse(feedbackRaw) : {};
      if (Array.isArray(parsedWorkflows)) {
        setWorkflows(parsedWorkflows);
      }
      if (Array.isArray(parsedPinned)) {
        setPinnedWorkflowIds(parsedPinned);
      }
      if (parsedFeedback && typeof parsedFeedback === 'object') {
        setFeedbackByMessageId(parsedFeedback);
      }
    } catch {
      setWorkflows([]);
      setPinnedWorkflowIds([]);
      setFeedbackByMessageId({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MESSAGE_FEEDBACK_KEY, JSON.stringify(feedbackByMessageId));
  }, [feedbackByMessageId]);

  useEffect(() => {
    if (!copiedMessageId) return;
    const timer = setTimeout(() => setCopiedMessageId(null), 1200);
    return () => clearTimeout(timer);
  }, [copiedMessageId]);

  const saveWorkflows = (next) => {
    setWorkflows(next);
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(next));
  };

  const savePinnedIds = (next) => {
    setPinnedWorkflowIds(next);
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
  };

  const resetChatState = () => {
    setMessages([]);
    setConversationHistory([]);
    setStatus('idle');
    setClassification(null);
    setTradeoffOpen(false);
    setLastPrompt('');
    setWorkflowRunning(false);
    setWorkflowProgress(null);
    setSimpleState({ running: false });
  };

  const filteredWorkflows = workflows
    .filter((entry) =>
      entry.title.toLowerCase().includes(sidebarSearchQuery.trim().toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pinnedWorkflows = filteredWorkflows.filter((entry) => pinnedWorkflowIds.includes(entry.id));
  const recentWorkflows = filteredWorkflows.filter((entry) => !pinnedWorkflowIds.includes(entry.id));
  const selectedArtifact = workflows.find((entry) => entry.id === selectedArtifactId) || null;
  const selectedWorkflow = workflows.find((entry) => entry.id === selectedWorkflowId) || null;

  const persistWorkflowEntry = (workflow, customTitle) => {
    if (!workflow) return;
    const title = (customTitle || workflow.title || '').trim() || getDefaultWorkflowName(workflow.originalPrompt);
    const payload = {
      id: workflow.id,
      title,
      summary: workflow.summary,
      originalPrompt: workflow.originalPrompt,
      steps: Array.isArray(workflow.steps) ? workflow.steps : [],
      createdAt: workflow.createdAt,
      reuseCount: Number.isFinite(workflow.reuseCount) ? workflow.reuseCount : 0,
    };
    const nextWorkflows = [payload, ...workflows.filter((entry) => entry.id !== payload.id)].slice(0, 100);
    saveWorkflows(nextWorkflows);
  };

  const deleteWorkflow = (workflowId) => {
    const next = workflows.filter((entry) => entry.id !== workflowId);
    saveWorkflows(next);
    savePinnedIds(pinnedWorkflowIds.filter((id) => id !== workflowId));
    if (selectedArtifactId === workflowId) {
      setSelectedArtifactId(next[0]?.id ?? null);
    }
  };

  useEffect(() => {
    if (activeView !== 'chat') return;
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages, status, classification, tradeoffOpen, workflowRunning, workflowProgress, activeView]);

  useEffect(() => {
    if (!pendingWorkflowSave) return;
    const timer = setTimeout(() => {
      persistWorkflowEntry(pendingWorkflowSave.workflow, pendingWorkflowSave.name);
      setMessages((prev) => prev.filter((message) => message.id !== pendingWorkflowSave.messageId));
      setPendingWorkflowSave(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [pendingWorkflowSave, workflows]);

  const restoreWorkflowFromHistory = (workflowId) => {
    const workflow = workflows.find((entry) => entry.id === workflowId);
    if (!workflow) return;
    setActiveView('chat');
    setMobileSidebarOpen(false);
    setMessages([
      { role: 'user', content: workflow.originalPrompt || workflow.title, id: crypto.randomUUID() },
      { type: 'workflow_meta', content: '↩ Restored from history', id: crypto.randomUUID() },
      { role: 'assistant', content: workflow.summary, id: crypto.randomUUID() },
    ]);
    setConversationHistory([
      { role: 'user', content: workflow.originalPrompt || workflow.title },
      { role: 'assistant', content: workflow.summary },
    ]);
    setStatus('idle');
    setClassification(null);
    setTradeoffOpen(false);
    setWorkflowRunning(false);
    setWorkflowProgress(null);
    setSimpleState({ running: false });
    setLastPrompt(workflow.originalPrompt || workflow.title);
    setInput('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const togglePinned = (workflowId) => {
    if (pinnedWorkflowIds.includes(workflowId)) {
      savePinnedIds(pinnedWorkflowIds.filter((id) => id !== workflowId));
      return;
    }
    savePinnedIds([workflowId, ...pinnedWorkflowIds]);
  };

  const getStepPreview = (content) => {
    const line = (content || '').replace(/\s+/g, ' ').trim();
    if (!line) return 'No output';
    return line.length > 90 ? `${line.slice(0, 90)}...` : line;
  };

  const openReuseModal = (workflowSource) => {
    if (!workflowSource) return;
    const stepDefs = (workflowSource.steps || [])
      .map((step, index) => ({
        id: `${workflowSource.id || 'wf'}-${index}`,
        name: typeof step === 'string' ? step : step?.name,
      }))
      .filter(Boolean);
    setReuseDraft({
      workflowId: workflowSource.id ?? null,
      name: workflowSource.title || 'Workflow',
      prompt: workflowSource.originalPrompt || '',
      steps: stepDefs,
    });
  };

  const runReusedWorkflow = async () => {
    if (!reuseDraft) return;
    const newPrompt = reuseDraft.prompt.trim();
    if (!newPrompt) return;

    if (reuseDraft.workflowId) {
      const next = workflows.map((entry) =>
        entry.id === reuseDraft.workflowId
          ? { ...entry, reuseCount: (entry.reuseCount || 0) + 1 }
          : entry
      );
      saveWorkflows(next);
    }

    const userMessage = { role: 'user', content: newPrompt, id: crypto.randomUUID() };
    const nextMessages = [...messages, userMessage];
    const nextHistory = [...conversationHistory, { role: 'user', content: newPrompt }];

    setActiveView('chat');
    setMobileSidebarOpen(false);
    setReuseDraft(null);
    setMessages(nextMessages);
    setConversationHistory(nextHistory);
    setLastPrompt(newPrompt);
    setStatus('idle');
    setClassification(null);
    setTradeoffOpen(false);
    setWorkflowRunning(false);
    setWorkflowProgress(null);
    setSimpleState({ running: false });
    setInput('');

    await runWorkflow({ steps: reuseDraft.steps.map((step) => step.name) }, newPrompt, nextHistory);
  };

  const savePendingWorkflowName = () => {
    if (!pendingWorkflowSave) return;
    persistWorkflowEntry(pendingWorkflowSave.workflow, pendingWorkflowSave.name);
    setMessages((prev) => prev.filter((message) => message.id !== pendingWorkflowSave.messageId));
    setPendingWorkflowSave(null);
  };

  const normalizeHistory = (sourceMessages) =>
    sourceMessages
      .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string')
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      }))
      .filter((entry) => entry.content.trim().length > 0)
      .slice(-20);

  const fetchWithTimeout = async (url, options, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return {
        response,
        clearTimeoutRef: () => clearTimeout(timer),
      };
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  };

  const getLatestUserMessageId = (messageList = messages) =>
    messageList.findLast((message) => message.role === 'user')?.id || null;

  const showInlineRequestError = (prompt) => {
    setInlineError({
      prompt,
      userMessageId: getLatestUserMessageId(),
    });
  };

  const processPrompt = async ({
    prompt,
    seedMessages = messages,
    seedHistory = conversationHistory,
    appendUser = true,
  }) => {
    let nextMessages = seedMessages;
    let nextHistory = seedHistory;

    if (appendUser) {
      const userMessage = { role: 'user', content: prompt, id: crypto.randomUUID() };
      nextMessages = [...seedMessages, userMessage];
      nextHistory = [...seedHistory, { role: 'user', content: prompt }];
      setMessages(nextMessages);
      setConversationHistory(nextHistory);
    }

    setInlineError(null);
    setActiveView('chat');
    setInput('');
    setLastPrompt(prompt);
    setTradeoffOpen(false);
    setClassification(null);
    setEducationExpanded(false);
    setWorkflowRunning(false);
    setWorkflowProgress(null);
    setSimpleState({ running: false });
    setInlineError(null);
    setStatus('classifying');
    let clearClassifyTimeout = () => {};

    try {
      const { response, clearTimeoutRef } = await fetchWithTimeout('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, history: normalizeHistory(nextHistory) }),
      });
      clearClassifyTimeout = clearTimeoutRef;

      if (!response.ok) {
        clearTimeoutRef();
        throw new Error('Classification failed');
      }

      const payload = await response.json();
      clearTimeoutRef();
      const nextClassification = payload.classification;
      const recommendation = nextClassification?.recommendation;

      if (recommendation === 'simple_prompt') {
        setStatus('idle');
        setTradeoffOpen(false);
        setClassification(null);
        await runSimplePrompt(prompt, nextHistory);
        return;
      }

      if (recommendation === 'workflow' || recommendation === 'agent' || recommendation === 'skill') {
        setClassification(nextClassification);
        setStatus('classified');
        return;
      }

      setStatus('idle');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I couldn't route this confidently. Please try rephrasing your prompt.",
          id: crypto.randomUUID(),
        },
      ]);
    } catch (error) {
      clearClassifyTimeout();
      setStatus('idle');
      setInlineError({
        prompt,
        userMessageId: nextMessages.findLast((message) => message.role === 'user')?.id || null,
      });
    }
  };

  const onSend = async () => {
    const prompt = input.trim();
    if (!prompt) {
      return;
    }
    await processPrompt({ prompt, appendUser: true });
  };

  const onConfirm = async (mode) => {
    const snapshotClassification = classification;
    const snapshotPrompt = lastPrompt;
    const sourceHistory = conversationHistory;
    setStatus('idle');
    setTradeoffOpen(false);
    setClassification(null);

    if (mode === 'workflow') {
      await runWorkflow(snapshotClassification, snapshotPrompt, sourceHistory);
      return;
    }

    await runSimplePrompt(snapshotPrompt, sourceHistory);
  };

  const startEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditDraft(message.content || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const saveEditedUserMessage = async (messageId) => {
    const updated = editDraft.trim();
    if (!updated) return;
    const index = messages.findIndex((entry) => entry.id === messageId);
    if (index < 0) return;
    const baseMessages = messages.slice(0, index).concat([{ ...messages[index], content: updated }]);
    const baseHistory = normalizeHistory(
      baseMessages
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .map((entry) => ({ role: entry.role, content: entry.content }))
    );
    setMessages(baseMessages);
    setConversationHistory(baseHistory);
    setEditingMessageId(null);
    setEditDraft('');
    await processPrompt({ prompt: updated, seedMessages: baseMessages, seedHistory: baseHistory, appendUser: false });
  };

  const regenerateFromUserMessage = async (messageId) => {
    const index = messages.findIndex((entry) => entry.id === messageId && entry.role === 'user');
    if (index < 0) return;
    const prompt = messages[index].content || '';
    const baseMessages = messages.slice(0, index + 1);
    const baseHistory = normalizeHistory(
      baseMessages
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .map((entry) => ({ role: entry.role, content: entry.content }))
    );
    setMessages(baseMessages);
    setConversationHistory(baseHistory);
    await processPrompt({ prompt, seedMessages: baseMessages, seedHistory: baseHistory, appendUser: false });
  };

  const regenerateAssistantMessage = async (messageId) => {
    const index = messages.findIndex((entry) => entry.id === messageId && entry.role === 'assistant');
    if (index < 0) return;
    const precedingUser = [...messages.slice(0, index)].reverse().find((entry) => entry.role === 'user');
    if (!precedingUser) return;
    const baseMessages = messages.slice(0, index);
    const baseHistory = normalizeHistory(
      baseMessages
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .map((entry) => ({ role: entry.role, content: entry.content }))
    );
    setMessages(baseMessages);
    setConversationHistory(baseHistory);
    await processPrompt({ prompt: precedingUser.content, seedMessages: baseMessages, seedHistory: baseHistory, appendUser: false });
  };

  const copyMessage = async (message) => {
    await navigator.clipboard.writeText(message.content || '');
    setCopiedMessageId(message.id);
  };

  const onDismissPanel = () => {
    setStatus('idle');
    setTradeoffOpen(false);
    setClassification(null);
    setInput('');
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: "Sure, I've dismissed this. Type your next prompt whenever you're ready.",
        id: crypto.randomUUID(),
      },
    ]);
    setConversationHistory((prev) => [
      ...prev,
      { role: 'assistant', content: "Sure, I've dismissed this. Type your next prompt whenever you're ready." },
    ]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const parseEventStream = async (response, onEvent) => {
    if (!response.body) {
      throw new Error('No stream body returned');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const dispatch = async (data) => {
      const maybe = onEvent(data);
      if (maybe && typeof maybe.then === 'function') await maybe;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split(/\n\n/);
      buffer = chunks.pop() ?? '';

      for (const rawChunk of chunks) {
        const lines = rawChunk.split(/\n/).filter((segment) => segment.startsWith('data: '));

        for (const line of lines) {
          const payload = line.slice('data: '.length).trim();

          if (payload === '' || payload === '[DONE]') {
            continue;
          }

          let data;

          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }

          await dispatch(data);
        }
      }
    }
  };

  const runWorkflow = async (classificationOverride, promptOverride, sourceHistory = conversationHistory) => {
    const activeClassification = classificationOverride ?? classification;
    const activePrompt =
      typeof promptOverride === 'string' && promptOverride.trim().length > 0
        ? promptOverride.trim()
        : lastPrompt;

    if (!activeClassification || !activePrompt) {
      return;
    }

    const activeSteps = (activeClassification.steps || [])
      .map((step) => (typeof step === 'string' ? step : step?.name))
      .filter(Boolean);
    if (activeSteps.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'No workflow steps available to run.', id: crypto.randomUUID() },
      ]);
      return;
    }

    setWorkflowRunning(true);
    const historyForRequest = normalizeHistory(sourceHistory);
    const stepCount = activeSteps.length;
    const outputByStep = {};
    let workflowCompleted = false;
    let currentStepIndex = 0;
    let clearWorkflowTimeout = () => {};

    const persistWorkflowSummary = (finalSummaryText) => {
      const orderedSteps = activeSteps
        .map((step) => ({
          step,
          content: (outputByStep[step] || '').trim(),
        }))
        .filter((item) => item.content.length > 0);

      if (orderedSteps.length === 0) {
        return;
      }

      const toggleId = crypto.randomUUID();
      const workflowId = String(Date.now());
      const namingMessageId = crypto.randomUUID();

      setExpandedWorkflowToggles((prev) => ({
        ...prev,
        [toggleId]: false,
      }));

      const finalSummary = typeof finalSummaryText === 'string' ? finalSummaryText : '';

      const workflowEntry = {
        id: workflowId,
        title: buildWorkflowTitle(activePrompt),
        summary: finalSummary || '',
        originalPrompt: activePrompt,
        steps: orderedSteps.map(({ step, content }) => ({ name: step, output: content })),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [
        ...prev,
        ...(finalSummary
          ? [{ role: 'assistant', content: finalSummary, id: crypto.randomUUID() }]
          : []),
        { type: 'workflow_meta', content: '✓ Workflow complete', id: crypto.randomUUID() },
        { type: 'workflow_name_prompt', id: namingMessageId, workflowId },
        { type: 'workflow_toggle', id: toggleId, steps: orderedSteps },
      ]);
      if (finalSummary) {
        setConversationHistory((prev) => [
          ...prev,
          { role: 'assistant', content: finalSummary },
        ]);
      }
      setPendingWorkflowSave({
        messageId: namingMessageId,
        workflow: workflowEntry,
        name: getDefaultWorkflowName(activePrompt),
      });
    };

    try {
      const { response, clearTimeoutRef } = await fetchWithTimeout('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt, steps: activeSteps, history: historyForRequest }),
      });
      clearWorkflowTimeout = clearTimeoutRef;

      if (!response.ok) {
        clearTimeoutRef();
        throw new Error('Workflow stream failed');
      }

      let finalSummaryFromWorkflow = '';
      await parseEventStream(response, (event) => {
        if (event.type === 'step_start') {
          currentStepIndex += 1;
          outputByStep[event.step] = '';
          setWorkflowProgress({
            currentStep: currentStepIndex,
            totalSteps: stepCount,
            stepName: event.step,
          });
        }

        if (event.type === 'step_chunk') {
          outputByStep[event.step] = `${outputByStep[event.step] || ''}${event.chunk}`;
        }

        if (event.type === 'summary') {
          finalSummaryFromWorkflow = typeof event.summary === 'string' ? event.summary : '';
        }

        if (event.type === 'done') {
          workflowCompleted = true;
          setWorkflowProgress(null);
        }
      });

      if (!workflowCompleted) {
        setWorkflowProgress(null);
      }

      clearTimeoutRef();
      persistWorkflowSummary(finalSummaryFromWorkflow);
      setWorkflowRunning(false);
    } catch (error) {
      clearWorkflowTimeout();
      setWorkflowRunning(false);
      setWorkflowProgress(null);
      showInlineRequestError(activePrompt);
    }
  };

  const runSimplePrompt = async (promptOverride, sourceHistory = conversationHistory, systemOverride = undefined) => {
    const promptText =
      typeof promptOverride === 'string' && promptOverride.trim().length > 0
        ? promptOverride.trim()
        : lastPrompt?.trim?.() ?? '';

    if (!promptText) {
      return '';
    }

    const streamId = crypto.randomUUID();
    const historyForRequest = normalizeHistory(sourceHistory);
    let streamedText = '';
    const shouldEnforceMarkdown = false;
    const appendToken = async (token) => {
      if (!token) return;
      streamedText += token;
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === streamId ? { ...message, content: message.content + token } : message
            )
          );
          resolve();
        });
      });
    };

    setSimpleState({ running: true });
    setInlineError(null);
    setMessages((prev) => [...prev, { role: 'assistant', content: '', id: streamId, streaming: true }]);
    let clearChatTimeout = () => {};

    let backlog = '';

    const flushWholeWordsFromBacklog = async () => {
      while (true) {
        const match = backlog.match(/^(\S+)(\s+)/);
        if (!match) break;
        const token = `${match[1]}${match[2]}`;
        backlog = backlog.slice(token.length);
        await appendToken(token);
      }
    };

    try {
      const { response, clearTimeoutRef } = await fetchWithTimeout('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, history: historyForRequest, system: systemOverride }),
      });
      clearChatTimeout = clearTimeoutRef;

      if (!response.ok) {
        clearTimeoutRef();
        throw new Error('Simple stream failed');
      }

      await parseEventStream(response, async (event) => {
        if (event.type === 'chunk' && typeof event.chunk === 'string' && event.chunk.length > 0) {
          backlog += event.chunk;
          await flushWholeWordsFromBacklog();
          return;
        }

        if (event.type === 'done') {
          await flushWholeWordsFromBacklog();
          if (backlog.length > 0) {
            await appendToken(backlog);
            backlog = '';
          }

          setSimpleState({ running: false });
          setMessages((prev) =>
            prev.map((message) => (message.id === streamId ? { ...message, streaming: false } : message))
          );
        }

        if (event.type === 'error') {
          throw new Error(event.message || 'Stream error');
        }
      });

      await flushWholeWordsFromBacklog();
      if (backlog.length > 0) {
        await appendToken(backlog);
        backlog = '';
      }
      clearTimeoutRef();

      let completedOutput = streamedText.trim();
      if (shouldEnforceMarkdown) {
        const normalized = enforceMarkdownBullets(streamedText);
        completedOutput = normalized;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === streamId ? { ...message, content: normalized } : message
          )
        );
      }

      if (completedOutput) {
        setConversationHistory((prev) => [
          ...prev,
          { role: 'assistant', content: completedOutput },
        ]);
      }

      setSimpleState({ running: false });
      setMessages((prev) =>
        prev.map((message) => (message.id === streamId ? { ...message, streaming: false } : message))
      );
      return completedOutput;
    } catch (error) {
      clearChatTimeout();
      setSimpleState({ running: false });
      setMessages((prev) => prev.filter((message) => message.id !== streamId));
      showInlineRequestError(promptText);
      return '';
    }
  };

  return (
    <>
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        searchOpen={sidebarSearchOpen}
        onToggleSearch={() => setSidebarSearchOpen((prev) => !prev)}
        searchQuery={sidebarSearchQuery}
        onSearchChange={setSidebarSearchQuery}
        onNewChat={() => {
          setActiveView('chat');
          resetChatState();
          setMobileSidebarOpen(false);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onShowWorkflows={() => {
          setActiveView('workflows');
          setSelectedWorkflowId(null);
          setMobileSidebarOpen(false);
        }}
        onShowArtifacts={() => {
          setActiveView('artifacts');
          setSelectedWorkflowId(null);
          setMobileSidebarOpen(false);
          if (!selectedArtifactId && workflows.length > 0) {
            setSelectedArtifactId(workflows[0].id);
          }
        }}
        workflowCount={workflows.length}
        pinnedWorkflows={pinnedWorkflows}
        recentWorkflows={recentWorkflows}
        onSelectWorkflow={restoreWorkflowFromHistory}
        onTogglePin={togglePinned}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 md:hidden"
          aria-label="Close sidebar backdrop"
        />
      )}
      {reuseDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-xl border border-[#e2e0d8] bg-white p-4">
            <h3 className="text-base font-semibold text-[#1a1917]">{reuseDraft.name}</h3>
            <label className="mt-3 block text-xs font-medium text-[#6b6860]">
              What do you want to run this workflow on?
            </label>
            <input
              value={reuseDraft.prompt}
              onChange={(event) => setReuseDraft((prev) => (prev ? { ...prev, prompt: event.target.value } : prev))}
              className="mt-1 min-h-11 w-full rounded-lg border border-[#d7d4cb] px-3 text-sm text-[#1a1917] outline-none focus:border-[#c96442]"
            />

            <div className="mt-3">
              <p className="text-xs text-[#6b6860]">Workflow steps</p>
              <div className="mt-2 space-y-3">
                {reuseDraft.steps.map((step, index) => (
                  <div key={step.id} className="relative pl-6">
                    {index < reuseDraft.steps.length - 1 && (
                      <span className="absolute left-2.5 top-6 h-[calc(100%-8px)] w-px bg-[#e2e0d8]" />
                    )}
                    <span className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#d7d4cb] bg-[#f7f5f0] text-[10px] text-[#6b6860]">
                      {index + 1}
                    </span>
                    <input
                      value={step.name}
                      onChange={(event) =>
                        setReuseDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                steps: prev.steps.map((entry) =>
                                  entry.id === step.id ? { ...entry, name: event.target.value } : entry
                                ),
                              }
                            : prev
                        )
                      }
                      className="min-h-9 w-full rounded-md border border-[#d7d4cb] px-2 text-sm text-[#1a1917] outline-none focus:border-[#c96442]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={runReusedWorkflow}
                className="w-full rounded-lg bg-[#c96442] px-4 py-2 text-sm font-medium text-white hover:bg-[#b85736] sm:w-auto"
              >
                Run workflow
              </button>
              <button
                type="button"
                onClick={() => setReuseDraft(null)}
                className="w-full rounded-lg border border-[#d7d4cb] bg-white px-4 py-2 text-sm font-medium text-[#6b6860] hover:bg-[#f7f5f0] sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <main
        className={`flex h-screen min-h-0 flex-col bg-[#f5f4ef] px-2 text-[#1a1917] transition-all duration-300 md:px-4 ${
          sidebarCollapsed ? 'md:ml-12 md:w-[calc(100%-48px)]' : 'md:ml-[260px] md:w-[calc(100%-260px)]'
        }`}
      >
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#e2e0d8]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="h-8 w-8 rounded-md text-[#6b6860] hover:bg-[#ece9e1] md:hidden"
            aria-label="Open sidebar"
          >
            ≡
          </button>
          <h1 className="text-lg font-semibold text-[#1a1917] md:text-xl">Claude Compass</h1>
        </div>
        <span className="hide-badge-xs rounded-full border border-[#c96442]/25 bg-[#fdf0eb] px-2 py-0.5 text-[11px] font-semibold text-[#c96442] md:px-3 md:py-1">
          Intent-aware routing
        </span>
      </header>

      <div className="h-[calc(100vh-60px)] min-h-0 flex flex-col">
      {activeView === 'workflows' ? (
        <section className="min-h-0 flex flex-1 overflow-hidden px-4 py-6 pb-10">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {workflows.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#d7d4cb] bg-white">
                <div className="text-center">
                  <p className="text-2xl">🧭</p>
                  <p className="mt-2 text-sm font-semibold text-[#1a1917]">No workflows saved yet</p>
                  <p className="mt-1 text-sm text-[#6b6860]">Complete your first workflow to save it here</p>
                </div>
              </div>
            ) : selectedWorkflow ? (
              <div className="rounded-xl border border-[#e2e0d8] bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkflowId(null);
                    }}
                    className="text-sm font-medium text-[#6b6860] hover:text-[#1a1917]"
                  >
                    ← Back
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => restoreWorkflowFromHistory(selectedWorkflow.id)}
                      className="rounded-lg bg-[#c96442] px-3 py-2 text-xs font-medium text-white hover:bg-[#b85736]"
                    >
                      Open in chat
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(selectedWorkflow.summary || '');
                      }}
                      className="rounded-lg border border-[#c96442]/35 bg-white px-3 py-2 text-xs font-medium text-[#c96442] hover:bg-[#fdf0eb]"
                    >
                      Copy summary
                    </button>
                  </div>
                </div>

                <h2 className="text-lg font-semibold text-[#1a1917]">{selectedWorkflow.title}</h2>
                <p className="mt-1 text-xs text-[#6b6860]">{new Date(selectedWorkflow.createdAt).toLocaleString()}</p>

                <div className="mt-4 rounded-lg border border-[#e2e0d8] bg-[#f7f5f0] p-3">
                  <p className="text-sm font-medium text-[#c96442]">Steps completed ({selectedWorkflow.steps.length})</p>
                  <div className="mt-3 space-y-3">
                    {selectedWorkflow.steps.map((step, index) => (
                      <div key={`${selectedWorkflow.id}-${step.name}-${index}`} className="border-b border-[#e2e0d8] pb-3 last:border-b-0 last:pb-0">
                        <p className="text-xs text-[#6b6860]">Step {index + 1}</p>
                        <p className="text-sm font-semibold text-[#1a1917]">{step.name}</p>
                        <MarkdownRenderer content={step.output} className="mt-1 text-sm text-[#1a1917]" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <MarkdownRenderer content={selectedWorkflow.summary || 'No summary available'} className="text-[#1a1917]" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {workflows
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((workflow) => (
                    <article
                      key={workflow.id}
                      onClick={() => {
                        setSelectedWorkflowId(workflow.id);
                      }}
                      className="group cursor-pointer rounded-xl border border-[#e2e0d8] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[#1a1917]">{workflow.title}</h3>
                          <p className="mt-1 text-xs text-[#6b6860]">{new Date(workflow.createdAt).toLocaleString()}</p>
                          <p className="mt-1 text-xs text-[#6b6860]">{Array.isArray(workflow.steps) ? workflow.steps.length : 0} steps completed</p>
                          <p className="mt-1 text-xs text-[#9a968d]">Used {workflow.reuseCount || 0} times</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteWorkflow(workflow.id);
                          }}
                          className="text-xs text-[#6b6860] opacity-0 transition group-hover:opacity-100 hover:text-[#c96442]"
                          title="Delete workflow"
                        >
                          🗑
                        </button>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-[#6b6860]">{workflow.summary}</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedWorkflowCards((prev) => ({
                            ...prev,
                            [workflow.id]: !prev[workflow.id],
                          }));
                        }}
                        className="mt-2 text-xs font-medium text-[#c96442]"
                      >
                        {expandedWorkflowCards[workflow.id] ? '▼' : '▶'} View steps ({Array.isArray(workflow.steps) ? workflow.steps.length : 0} steps)
                      </button>
                      {expandedWorkflowCards[workflow.id] && (
                        <ol className="mt-2 space-y-1 text-xs text-[#6b6860]">
                          {workflow.steps.map((step, index) => (
                            <li key={`${workflow.id}-preview-${index}`} className="rounded-md border border-[#e2e0d8] bg-[#f7f5f0] px-2 py-1">
                              <span className="font-medium text-[#1a1917]">{index + 1}. {step.name}</span>
                              <span className="ml-1">— {getStepPreview(step.output)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            restoreWorkflowFromHistory(workflow.id);
                          }}
                          className="w-full rounded-lg bg-[#c96442] px-3 py-2 text-xs font-medium text-white hover:bg-[#b85736] sm:w-auto"
                        >
                          Open in chat
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReuseModal(workflow);
                          }}
                          className="w-full rounded-lg border border-[#c96442]/35 bg-white px-3 py-2 text-xs font-medium text-[#c96442] hover:bg-[#fdf0eb] sm:w-auto"
                        >
                          ↻ Reuse
                        </button>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await navigator.clipboard.writeText(workflow.summary || '');
                          }}
                          className="w-full rounded-lg border border-[#c96442]/35 bg-white px-3 py-2 text-xs font-medium text-[#c96442] hover:bg-[#fdf0eb] sm:w-auto"
                        >
                          Copy summary
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </div>
        </section>
      ) : activeView === 'artifacts' ? (
        <section className="min-h-0 flex flex-1 gap-4 overflow-hidden px-4 py-6 pb-10">
          <div className="w-[320px] overflow-y-auto rounded-xl border border-[#e2e0d8] bg-white p-3">
            <h2 className="mb-3 text-sm font-semibold text-[#1a1917]">Artifacts</h2>
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setSelectedArtifactId(workflow.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selectedArtifactId === workflow.id
                      ? 'border-[#c96442] bg-[#fdf0eb]'
                      : 'border-[#e2e0d8] bg-white hover:bg-[#f7f5f0]'
                  }`}
                >
                  <p className="truncate text-sm font-medium text-[#1a1917]">{workflow.title}</p>
                  <p className="mt-1 text-xs text-[#6b6860]">
                    {new Date(workflow.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[#6b6860]">{workflow.summary}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#e2e0d8] bg-white p-5">
            {selectedArtifact ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1a1917]">{selectedArtifact.title}</h3>
                    <p className="text-xs text-[#6b6860]">
                      {new Date(selectedArtifact.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(selectedArtifact.summary || '');
                    }}
                    className="rounded-lg border border-[#c96442]/35 px-3 py-1.5 text-xs font-medium text-[#c96442] hover:bg-[#fdf0eb]"
                  >
                    Copy
                  </button>
                </div>
                <MarkdownRenderer content={selectedArtifact.summary || 'No summary available'} className="text-[#1a1917]" />
              </>
            ) : (
              <p className="text-sm text-[#6b6860]">Select an artifact to read.</p>
            )}
          </div>
        </section>
      ) : (
        <section ref={chatContainerRef} className="min-h-0 flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6 pb-10">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#d7d4cb] bg-[#ffffff] p-4 text-sm text-[#6b6860]">
            Enter a prompt to classify it and route execution through workflow or simple prompt.
          </p>
        )}

        {messages.map((message) => (
          message.type === 'workflow_meta' ? (
            <div
              key={message.id}
              className={`mr-auto mb-2 flex w-full max-w-[760px] items-center gap-1 text-[11px] font-medium ${
                message.content.startsWith('↩') ? 'text-[#6b6860]' : 'text-[#1a6b3c]'
              }`}
            >
              <span aria-hidden="true">{message.content.startsWith('↩') ? '↩' : '✓'}</span>
              <span>{message.content.startsWith('↩') ? 'Restored from history' : 'Workflow complete'}</span>
            </div>
          ) : message.type === 'workflow_name_prompt' ? (
            <div key={message.id} className="mr-auto mb-2 w-full max-w-[760px] rounded-lg border border-[#e2e0d8] bg-white p-3">
              <p className="text-xs font-medium text-[#6b6860]">Name this workflow:</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={pendingWorkflowSave?.name ?? ''}
                  onChange={(event) =>
                    setPendingWorkflowSave((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                  }
                  className="min-h-11 flex-1 rounded-lg border border-[#d7d4cb] bg-[#ffffff] px-3 text-sm text-[#1a1917] outline-none focus:border-[#c96442]"
                />
                <button
                  type="button"
                  onClick={savePendingWorkflowName}
                  className="min-h-11 rounded-lg bg-[#c96442] px-4 text-sm font-medium text-white hover:bg-[#b85736]"
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingWorkflowSave?.workflow) return;
                  openReuseModal(pendingWorkflowSave.workflow);
                }}
                className="mt-2 text-xs font-medium text-[#6b6860] hover:text-[#1a1917]"
              >
                ↩ Run again with different input
              </button>
            </div>
          ) : message.type === 'workflow_toggle' ? (
            <div key={message.id} className="mr-auto mb-2 w-full max-w-[760px]">
              <button
                type="button"
                onClick={() =>
                  setExpandedWorkflowToggles((prev) => ({
                    ...prev,
                    [message.id]: !prev[message.id],
                  }))
                }
                className="text-sm font-medium text-[#c96442]"
              >
                <span className="md:hidden">
                  {expandedWorkflowToggles[message.id] ? '▼' : '▶'} Steps ({message.steps.length})
                </span>
                <span className="hidden md:inline">
                  {expandedWorkflowToggles[message.id] ? '▼' : '▶'} Show workflow steps ({message.steps.length} steps completed)
                </span>
              </button>
              {expandedWorkflowToggles[message.id] && (
                <div className="mt-3 space-y-3">
                  {message.steps.map((step, index) => (
                    <div key={`${message.id}-${step.step}`} className="rounded-lg border border-[#e2e0d8] bg-[#ffffff] p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f7f5f0] text-[10px] font-semibold text-[#6b6860]">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-[#1a1917]">{step.step}</p>
                      </div>
                      <div className="mt-2 rounded-md bg-[#f0efe9] p-2">
                        <MarkdownRenderer content={step.content} className="text-sm text-[#1a1917]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={message.id} className={`w-full ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            <article
              className={`group w-full rounded-2xl text-[14px] leading-relaxed md:max-w-[760px] md:text-[15px] ${
                message.role === 'user'
                  ? 'ml-auto max-w-[88%] bg-[#d97757] px-3 py-2.5 text-white md:max-w-[760px] md:p-[14px]'
                  : 'mr-auto max-w-[92%] bg-[#f0efe9] px-3 py-2.5 text-[#1a1917] md:max-w-[760px] md:p-[14px]'
              }`}
            >
              {editingMessageId === message.id && message.role === 'user' ? (
                <div>
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    className="min-h-20 w-full rounded-lg border border-white/40 bg-white/10 p-2 text-sm text-white outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => saveEditedUserMessage(message.id)} className="rounded-md bg-white/20 px-2 py-1 text-xs">Save</button>
                    <button type="button" onClick={cancelEditMessage} className="rounded-md bg-white/20 px-2 py-1 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <MarkdownRenderer
                  content={message.content || (message.streaming ? '...' : '')}
                  className=""
                />
              )}

              {!message.streaming && (
                <div
                  className={`mt-2 flex gap-1 rounded-full bg-black/5 p-1 ${
                    message.role === 'user' ? 'ml-auto w-fit opacity-100' : 'mr-auto w-fit opacity-100'
                  }`}
                >
                  {message.role === 'user' ? (
                    <>
                      <button type="button" onClick={() => startEditMessage(message)} className="rounded px-1 text-xs text-[#6b6860] hover:bg-white">✏️</button>
                      <button type="button" onClick={() => copyMessage(message)} className="rounded px-1 text-xs text-[#6b6860] hover:bg-white">📋</button>
                      <button type="button" onClick={() => regenerateFromUserMessage(message.id)} className="rounded px-1 text-xs text-[#6b6860] hover:bg-white">🔄</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => copyMessage(message)} className="rounded px-1 text-xs text-[#6b6860] hover:bg-white">📋</button>
                      <button type="button" onClick={() => regenerateAssistantMessage(message.id)} className="rounded px-1 text-xs text-[#6b6860] hover:bg-white">🔄</button>
                      <button
                        type="button"
                        onClick={() => setFeedbackByMessageId((prev) => ({ ...prev, [message.id]: 'up' }))}
                        className={`rounded px-1 text-xs hover:bg-white ${feedbackByMessageId[message.id] === 'up' ? 'text-[#c96442]' : 'text-[#6b6860]'}`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackByMessageId((prev) => ({ ...prev, [message.id]: 'down' }))}
                        className={`rounded px-1 text-xs hover:bg-white ${feedbackByMessageId[message.id] === 'down' ? 'text-[#c96442]' : 'text-[#6b6860]'}`}
                      >
                        👎
                      </button>
                    </>
                  )}
                </div>
              )}
              {copiedMessageId === message.id && (
                <p className={`mt-1 text-[11px] ${message.role === 'user' ? 'text-white/80' : 'text-[#6b6860]'}`}>Copied!</p>
              )}
            </article>
            {inlineError?.userMessageId === message.id && (
              <div className="mt-1 w-full max-w-[760px] text-sm text-[#b42318]">
                <span>Something went wrong. Try again </span>
                <button
                  type="button"
                  onClick={() => processPrompt({ prompt: inlineError.prompt, appendUser: false })}
                  className="font-medium underline"
                >
                  →
                </button>
              </div>
            )}
            </div>
          )
        ))}
        {isApiLoading && (
          <div className="mr-auto max-w-[92%] rounded-2xl bg-[#f0efe9] px-3 py-2.5 text-[#6b6860] md:max-w-[760px] md:p-[14px]">
            <div className="flex items-center gap-1 text-lg leading-none">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse [animation-delay:120ms]">.</span>
              <span className="animate-pulse [animation-delay:240ms]">.</span>
            </div>
          </div>
        )}
        <CompassPanel
          status={status}
          classification={classification}
          tradeoffOpen={tradeoffOpen}
          educationExpanded={educationExpanded}
          onToggleEducationExpanded={() => setEducationExpanded((prev) => !prev)}
          onChooseAction={() => {
            setTradeoffOpen(true);
          }}
          onDismiss={onDismissPanel}
          onConfirm={onConfirm}
        />
        {workflowRunning && workflowProgress && (
          <div className="mr-auto flex w-full max-w-[760px] items-center gap-2 rounded-xl border border-[#e2e0d8] bg-[#ffffff] p-3 text-sm text-[#6b6860]">
            <Spinner />
            <div className="w-full">
              <p>
                ⚙ Step {workflowProgress.currentStep} of {workflowProgress.totalSteps} — {workflowProgress.stepName}...
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e7e4dc]">
                <div
                  className="h-full rounded-full bg-[#c96442] transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((workflowProgress.currentStep / workflowProgress.totalSteps) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {assistantMessage?.streaming && !workflowRunning && (
          <p className="text-xs text-[#6b6860]">Response is streaming...</p>
        )}
      </section>
      )}

      {activeView === 'chat' && (
      <footer className="sticky bottom-0 z-20 border-t border-[#e2e0d8] bg-[#f5f4ef] py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
          className="flex items-end gap-3"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-11 flex-1 resize-none rounded-xl border border-[#d7d4cb] bg-[#ffffff] p-3 text-[14px] text-[#1a1917] outline-none transition placeholder:text-[#6b6860] focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/20 md:min-h-14"
            placeholder="Type your prompt..."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c96442] text-sm font-semibold text-white transition hover:bg-[#b85736] disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:px-5 md:py-3"
          >
            <span className="md:hidden">➤</span>
            <span className="hidden md:inline">Send</span>
          </button>
        </form>
      </footer>
      )}
      </div>
      </main>
    </>
  );
}

export default App;
