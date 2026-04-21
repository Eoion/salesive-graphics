import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const EDITOR_AI_CONVERSATION_KEY = 'salesive_editor_ai_conversation';

const DEFAULT_NAMESPACE = '/agent/svg-editor';

const TOOL_PHASE_MAP = {
  get_canvas_state: 'reading',
  list_elements: 'reading',
  get_element: 'reading',
  take_screenshot: 'reading',
  select_element: 'selecting',
  update_element: 'editing',
  delete_element: 'editing',
  add_element: 'editing',
  duplicate_element: 'editing',
  move_element: 'editing',
  resize_element: 'editing',
  set_fill: 'editing',
  set_stroke: 'editing',
  set_opacity: 'editing',
  set_text: 'editing',
  lock_element: 'editing',
  unlock_element: 'editing',
  bring_forward: 'editing',
  send_backward: 'editing',
  agent_thought: 'thinking',
};

function toolPhase(tool) {
  return TOOL_PHASE_MAP[tool] || 'working';
}

function makeId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeConversationId() {
  return `editor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadConversationId() {
  try {
    const stored = localStorage.getItem(EDITOR_AI_CONVERSATION_KEY);
    if (stored) return stored;
  } catch {}
  const id = makeConversationId();
  try { localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, id); } catch {}
  return id;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function finalizeStreaming(messages) {
  return messages.map(m => m.role === 'ai' && m.isStreaming ? { ...m, isStreaming: false } : m);
}

function upsertToolCall(messages, next) {
  let found = false;
  const updated = messages.map(m => {
    if (m.role !== 'tool_call' || m.toolCallId !== next.toolCallId) return m;
    found = true;
    return { ...m, ...next };
  });
  return found ? updated : [...updated, next];
}

function normalizeHistory(history) {
  const resultMap = {};
  for (const msg of history) {
    if (msg.role === 'tool' && msg.metadata?.tool_call_id) {
      resultMap[msg.metadata.tool_call_id] = msg.content;
    }
  }
  const out = [];
  for (const msg of history) {
    if (msg.role === 'tool') continue;
    if (msg.role === 'tool_call') {
      const id = msg.metadata?.tool_call_id || msg.toolCallId;
      let args = {};
      try { if (msg.content) args = JSON.parse(msg.content); } catch {}
      out.push({ ...msg, role: 'tool_call', tool: msg.toolName || msg.tool, toolCallId: id, args, result: resultMap[id] || null, status: resultMap[id] ? 'done' : 'running' });
    } else {
      out.push(msg);
    }
  }
  return out;
}

export function clearStoredEditorAiSession() {
  try { localStorage.removeItem(EDITOR_AI_CONVERSATION_KEY); } catch {}
}

export function useEditorAgent({ getEditorContext, clientToolHandlers = {} } = {}) {
  const serverUrl = import.meta.env.VITE_EDITOR_AI_URL || '';
  const namespace = import.meta.env.VITE_EDITOR_AI_NAMESPACE || DEFAULT_NAMESPACE;
  const isConfigured = Boolean(serverUrl);

  const [conversationId, setConversationId] = useState(loadConversationId);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(isConfigured);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAgentDone, setIsAgentDone] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  // agentCursor: tracks what the agent is currently doing for the cursor overlay
  const [agentCursor, setAgentCursor] = useState({ visible: false, elementId: null, thought: null, phase: 'idle' });

  const socketRef = useRef(null);
  const connectPromiseRef = useRef(null);
  const getEditorContextRef = useRef(getEditorContext);
  const clientToolHandlersRef = useRef(clientToolHandlers);
  const idleTimerRef = useRef(null);

  useEffect(() => { getEditorContextRef.current = getEditorContext; }, [getEditorContext]);
  useEffect(() => { clientToolHandlersRef.current = clientToolHandlers; }, [clientToolHandlers]);
  useEffect(() => { try { localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, conversationId); } catch {} }, [conversationId]);

  function clearIdleTimer() {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
  }
  function resetIdleTimer() {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      setIsAgentDone(true); setIsStreaming(false); setIsThinking(false);
    }, 60000);
  }

  const ensureConnected = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return Promise.reject(new Error('AI socket not configured'));
    if (socket.connected) return Promise.resolve(socket);
    if (connectPromiseRef.current) return connectPromiseRef.current;
    connectPromiseRef.current = new Promise((resolve, reject) => {
      const cleanup = () => { socket.off('connect', onOk); socket.off('connect_error', onErr); };
      const onOk = () => { cleanup(); connectPromiseRef.current = null; resolve(socket); };
      const onErr = (e) => { cleanup(); connectPromiseRef.current = null; reject(e); };
      socket.once('connect', onOk);
      socket.once('connect_error', onErr);
      setIsConnecting(true);
      socket.connect();
    });
    return connectPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!isConfigured) return;

    const socket = io(`${serverUrl}${namespace}`, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;
    socket.connect();

    socket.on('connect', () => { setIsConnecting(false); setError(null); });
    socket.on('disconnect', (reason) => {
      clearIdleTimer();
      setIsConnecting(true); setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.on('connect_error', (e) => {
      clearIdleTimer();
      setIsConnecting(false); setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
      setError(e?.message || 'Unable to connect to AI service.');
    });

    socket.on('agent:thinking', () => {
      resetIdleTimer();
      setIsThinking(true);
      setIsAgentDone(false);
      setAgentCursor(prev => ({ ...prev, visible: true, phase: 'thinking', thought: null }));
    });

    socket.on('agent:token', (token) => {
      const content = typeof token === 'string' ? token : token?.content || token?.token || '';
      resetIdleTimer();
      setIsStreaming(true); setIsThinking(false); setIsAgentDone(false); setError(null);
      setAgentCursor(prev => ({ ...prev, phase: 'responding' }));
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, content: `${last.content || ''}${content}` }];
        }
        return [...prev, { id: makeId('ai'), role: 'ai', content, createdAt: new Date().toISOString(), isStreaming: true }];
      });
    });

    socket.on('agent:response', (payload) => {
      const content = typeof payload === 'string' ? payload : payload?.content || '';
      const convId = typeof payload === 'object' ? payload?.conversationId : null;
      clearIdleTimer();
      setIsStreaming(false); setIsAgentDone(true); setIsThinking(false); setError(null);
      if (convId) { setConversationId(convId); try { localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, convId); } catch {} }
      setAgentCursor({ visible: false, elementId: null, thought: null, phase: 'idle' });
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, content, isStreaming: false }];
        }
        return [...finalizeStreaming(prev), { id: makeId('ai'), role: 'ai', content, createdAt: new Date().toISOString(), isStreaming: false }];
      });
    });

    socket.on('agent:done', () => {
      clearIdleTimer();
      setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
      setAgentCursor({ visible: false, elementId: null, thought: null, phase: 'idle' });
      setMessages(prev => finalizeStreaming(prev));
    });

    socket.on('agent:error', (e) => {
      clearIdleTimer();
      const msg = e?.message || e || 'The AI request failed.';
      setError(msg); setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
      setAgentCursor({ visible: false, elementId: null, thought: null, phase: 'idle' });
      setMessages(prev => finalizeStreaming(prev));
    });

    socket.on('agent:tool_call', ({ tool, input, args, toolCallId }) => {
      resetIdleTimer();
      setIsStreaming(false); setIsAgentDone(false); setIsThinking(false); setError(null);
      const elementId = args?.id || args?.elementId || args?.element_id || null;
      setAgentCursor({ visible: true, elementId, thought: null, phase: toolPhase(tool) });
      setMessages(prev => upsertToolCall(finalizeStreaming(prev), {
        id: toolCallId || makeId('tool'), role: 'tool_call', tool, input, args,
        toolCallId: toolCallId || makeId('call'), status: 'running', createdAt: new Date().toISOString(),
      }));
    });

    socket.on('agent:tool_result', ({ toolCallId, result, error: toolError }) => {
      resetIdleTimer();
      setMessages(prev => upsertToolCall(prev, {
        toolCallId, status: toolError ? 'error' : 'done',
        result: toolError ? null : parseMaybeJson(result), error: toolError || null,
      }));
    });

    socket.on('conversation:list', (list) => { setConversations(Array.isArray(list) ? list : []); });

    socket.on('conversation:history', ({ messages: history }) => {
      setMessages(normalizeHistory(Array.isArray(history) ? history : []));
    });

    socket.on('tool:execute', async ({ tool, args, toolCallId }) => {
      const tcId = toolCallId || makeId('call');
      resetIdleTimer();
      setIsAgentDone(false); setError(null);
      const elementId = args?.id || args?.elementId || args?.element_id || null;
      setAgentCursor({ visible: true, elementId, thought: null, phase: toolPhase(tool) });
      setMessages(prev => upsertToolCall(finalizeStreaming(prev), {
        id: tcId, role: 'tool_call', tool, args, toolCallId: tcId,
        status: 'running', createdAt: new Date().toISOString(), isClientTool: true,
      }));

      // Built-in: agent_thought
      if (tool === 'agent_thought') {
        const thought = args?.message || args?.thought || '';
        setAgentCursor(prev => ({ ...prev, thought, phase: 'thinking' }));
        await new Promise(r => setTimeout(r, Math.min(thought.length * 40, 3000)));
        setAgentCursor(prev => ({ ...prev, thought: null, phase: prev.elementId ? 'working' : 'idle' }));
        socket.emit('tool:response', { toolCallId: tcId, result: 'thought expressed' });
        setMessages(prev => upsertToolCall(prev, { toolCallId: tcId, status: 'done', result: 'thought expressed' }));
        return;
      }

      const handler = clientToolHandlersRef.current[tool];
      if (!handler) {
        const msg = `No handler for tool "${tool}"`;
        socket.emit('tool:response', { toolCallId: tcId, error: msg });
        setMessages(prev => upsertToolCall(prev, { toolCallId: tcId, status: 'error', error: msg }));
        return;
      }

      try {
        const result = await handler(args || {});
        const serialized = typeof result === 'string' ? result : JSON.stringify(result);
        socket.emit('tool:response', { toolCallId: tcId, result: serialized });
        setMessages(prev => upsertToolCall(prev, { toolCallId: tcId, status: 'done', result: parseMaybeJson(serialized) }));
      } catch (err) {
        const msg = err?.message || String(err) || 'Tool execution failed.';
        socket.emit('tool:response', { toolCallId: tcId, error: msg });
        setMessages(prev => upsertToolCall(prev, { toolCallId: tcId, status: 'error', error: msg }));
      }
    });

    return () => {
      clearIdleTimer();
      connectPromiseRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isConfigured, namespace, serverUrl]);

  const sendMessage = useCallback(async (input, imageUrls = []) => {
    const trimmed = (input || '').trim();
    if (!trimmed && imageUrls.length === 0) return false;
    if (!isConfigured) return false;
    try {
      const socket = await ensureConnected();
      setError(null);
      setIsAgentDone(false);
      setIsThinking(true);
      resetIdleTimer();
      setAgentCursor({ visible: true, elementId: null, thought: null, phase: 'thinking' });
      setMessages(prev => [...prev, {
        id: makeId('user'), role: 'user', content: trimmed,
        images: imageUrls, createdAt: new Date().toISOString(),
      }]);
      socket.emit('agent:message', {
        conversationId,
        input: trimmed,
        images: imageUrls,
        context: getEditorContextRef.current?.() || null,
      });
      return true;
    } catch (e) {
      setError(e?.message || 'Unable to send message.');
      setIsAgentDone(true); setIsThinking(false);
      return false;
    }
  }, [conversationId, ensureConnected, isConfigured]);

  const loadHistory = useCallback((convId) => {
    socketRef.current?.emit('conversation:history', { conversationId: convId, limit: 50 });
  }, []);

  const fetchConversations = useCallback(() => {
    socketRef.current?.emit('conversation:list', { limit: 20 });
  }, []);

  const stop = useCallback(() => {
    if (socketRef.current?.connected) socketRef.current.emit('agent:stop', {});
    clearIdleTimer();
    setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
    setAgentCursor({ visible: false, elementId: null, thought: null, phase: 'idle' });
    setMessages(prev => finalizeStreaming(prev));
  }, []);

  const clearConversation = useCallback(() => {
    const nextId = makeConversationId();
    setConversationId(nextId);
    setMessages([]); setError(null);
    setIsStreaming(false); setIsAgentDone(true); setIsThinking(false);
    setAgentCursor({ visible: false, elementId: null, thought: null, phase: 'idle' });
  }, []);

  const selectConversation = useCallback((convId) => {
    setConversationId(convId);
    setMessages([]); setError(null);
    try { localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, convId); } catch {}
    loadHistory(convId);
  }, [loadHistory]);

  return {
    conversationId, messages, conversations, error,
    isConfigured, isConnecting, isStreaming, isAgentDone, isThinking,
    agentCursor,
    sendMessage, stop, clearConversation, loadHistory, fetchConversations, selectConversation,
  };
}
