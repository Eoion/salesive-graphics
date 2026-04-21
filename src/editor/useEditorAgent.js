import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const EDITOR_AI_CONVERSATION_KEY = 'salesive_editor_ai_conversation';
export const EDITOR_AI_MESSAGES_KEY = 'salesive_editor_ai_messages';

const DEFAULT_NAMESPACE = '/agent/svg-editor';

function ignoreStorageError() {}

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
  } catch (error) {
    ignoreStorageError(error);
  }
  const created = makeConversationId();
  try {
    localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, created);
  } catch (error) {
    ignoreStorageError(error);
  }
  return created;
}

function loadMessages() {
  try {
    const stored = localStorage.getItem(EDITOR_AI_MESSAGES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistConversationId(conversationId) {
  try {
    localStorage.setItem(EDITOR_AI_CONVERSATION_KEY, conversationId);
  } catch (error) {
    ignoreStorageError(error);
  }
}

function persistMessages(messages) {
  try {
    localStorage.setItem(EDITOR_AI_MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    ignoreStorageError(error);
  }
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function finalizeStreaming(messages) {
  return messages.map((message) => (
    message.role === 'ai' && message.isStreaming
      ? { ...message, isStreaming: false }
      : message
  ));
}

function upsertToolCall(messages, nextMessage) {
  let found = false;
  const updated = messages.map((message) => {
    if (message.role !== 'tool_call' || message.toolCallId !== nextMessage.toolCallId) {
      return message;
    }
    found = true;
    return { ...message, ...nextMessage };
  });

  if (found) return updated;
  return [...updated, nextMessage];
}

export function clearStoredEditorAiSession() {
  try {
    localStorage.removeItem(EDITOR_AI_CONVERSATION_KEY);
    localStorage.removeItem(EDITOR_AI_MESSAGES_KEY);
  } catch (error) {
    ignoreStorageError(error);
  }
}

export function useEditorAgent({ getEditorContext, clientToolHandlers = {} } = {}) {
  const serverUrl = import.meta.env.VITE_EDITOR_AI_URL || '';
  const namespace = import.meta.env.VITE_EDITOR_AI_NAMESPACE || DEFAULT_NAMESPACE;
  const isConfigured = Boolean(serverUrl);

  const [conversationId, setConversationId] = useState(loadConversationId);
  const [messages, setMessages] = useState(loadMessages);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(isConfigured);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAgentDone, setIsAgentDone] = useState(true);

  const socketRef = useRef(null);
  const connectPromiseRef = useRef(null);
  const getEditorContextRef = useRef(getEditorContext);
  const clientToolHandlersRef = useRef(clientToolHandlers);

  useEffect(() => {
    getEditorContextRef.current = getEditorContext;
  }, [getEditorContext]);

  useEffect(() => {
    clientToolHandlersRef.current = clientToolHandlers;
  }, [clientToolHandlers]);

  useEffect(() => {
    persistConversationId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  const ensureConnected = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) {
      return Promise.reject(new Error('AI socket is not configured.'));
    }
    if (socket.connected) return Promise.resolve(socket);
    if (connectPromiseRef.current) return connectPromiseRef.current;

    connectPromiseRef.current = new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
      };

      const handleConnect = () => {
        cleanup();
        connectPromiseRef.current = null;
        resolve(socket);
      };

      const handleError = (connectError) => {
        cleanup();
        connectPromiseRef.current = null;
        reject(connectError);
      };

      socket.once('connect', handleConnect);
      socket.once('connect_error', handleError);
      setIsConnecting(true);
      socket.connect();
    });

    return connectPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!isConfigured) return undefined;

    const socket = io(`${serverUrl}${namespace}`, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    socketRef.current = socket;
    socket.connect();

    socket.on('connect', () => {
      setIsConnecting(false);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnecting(true);
      setIsStreaming(false);
      setIsAgentDone(true);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (connectError) => {
      setIsConnecting(false);
      setIsStreaming(false);
      setIsAgentDone(true);
      setError(connectError?.message || 'Unable to connect to the editor AI service.');
    });

    socket.on('agent:token', (token) => {
      const content = typeof token === 'string' ? token : token?.content || token?.token || '';
      setError(null);
      setIsStreaming(true);
      setIsAgentDone(false);
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'ai' && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: `${lastMessage.content || ''}${content}` },
          ];
        }
        return [...prev, {
          id: makeId('ai'),
          role: 'ai',
          content,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        }];
      });
    });

    socket.on('agent:response', (payload) => {
      const content = typeof payload === 'string' ? payload : payload?.content || '';
      setError(null);
      setIsStreaming(false);
      setIsAgentDone(true);
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'ai' && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content, isStreaming: false },
          ];
        }
        return [...finalizeStreaming(prev), {
          id: makeId('ai'),
          role: 'ai',
          content,
          createdAt: new Date().toISOString(),
          isStreaming: false,
        }];
      });
    });

    socket.on('agent:done', () => {
      setIsStreaming(false);
      setIsAgentDone(true);
      setMessages((prev) => finalizeStreaming(prev));
    });

    socket.on('agent:error', (agentError) => {
      const message = agentError?.message || agentError || 'The AI request failed.';
      setError(message);
      setIsStreaming(false);
      setIsAgentDone(true);
      setMessages((prev) => finalizeStreaming(prev));
    });

    socket.on('agent:tool_call', ({ tool, input, args, toolCallId }) => {
      setError(null);
      setIsStreaming(false);
      setIsAgentDone(false);
      setMessages((prev) => upsertToolCall(finalizeStreaming(prev), {
        id: toolCallId || makeId('tool'),
        role: 'tool_call',
        tool,
        input,
        args,
        toolCallId: toolCallId || makeId('call'),
        status: 'running',
        createdAt: new Date().toISOString(),
      }));
    });

    socket.on('agent:tool_result', ({ toolCallId, result, error: toolError }) => {
      setMessages((prev) => upsertToolCall(prev, {
        toolCallId,
        status: toolError ? 'error' : 'done',
        result: toolError ? null : parseMaybeJson(result),
        error: toolError || null,
      }));
    });

    socket.on('tool:execute', async ({ tool, args, toolCallId }) => {
      const resolvedToolCallId = toolCallId || makeId('call');
      setError(null);
      setIsStreaming(false);
      setIsAgentDone(false);
      setMessages((prev) => upsertToolCall(finalizeStreaming(prev), {
        id: resolvedToolCallId,
        role: 'tool_call',
        tool,
        args,
        toolCallId: resolvedToolCallId,
        status: 'running',
        createdAt: new Date().toISOString(),
        isClientTool: true,
      }));

      const handler = clientToolHandlersRef.current[tool];
      if (!handler) {
        const handlerError = `No client handler registered for "${tool}".`;
        socket.emit('tool:response', { toolCallId: resolvedToolCallId, error: handlerError });
        setMessages((prev) => upsertToolCall(prev, {
          toolCallId: resolvedToolCallId,
          status: 'error',
          error: handlerError,
        }));
        return;
      }

      try {
        const result = await handler(args || {});
        socket.emit('tool:response', {
          toolCallId: resolvedToolCallId,
          result: typeof result === 'string' ? result : JSON.stringify(result),
        });
        setMessages((prev) => upsertToolCall(prev, {
          toolCallId: resolvedToolCallId,
          status: 'done',
          result,
          error: null,
        }));
      } catch (toolError) {
        const message = toolError?.message || String(toolError) || 'Tool execution failed.';
        socket.emit('tool:response', { toolCallId: resolvedToolCallId, error: message });
        setMessages((prev) => upsertToolCall(prev, {
          toolCallId: resolvedToolCallId,
          status: 'error',
          error: message,
        }));
      }
    });

    return () => {
      connectPromiseRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isConfigured, namespace, serverUrl]);

  const sendMessage = useCallback(async (input) => {
    const trimmed = input.trim();
    if (!trimmed || !isConfigured) return false;

    try {
      const socket = await ensureConnected();
      setError(null);
      setIsAgentDone(false);
      setMessages((prev) => [...prev, {
        id: makeId('user'),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }]);

      socket.emit('agent:message', {
        conversationId,
        input: trimmed,
        editorContext: getEditorContextRef.current ? getEditorContextRef.current() : null,
      });

      return true;
    } catch (sendError) {
      setError(sendError?.message || 'Unable to send your message right now.');
      setIsAgentDone(true);
      return false;
    }
  }, [conversationId, ensureConnected, isConfigured]);

  const stop = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('agent:stop', {});
    }
    setIsStreaming(false);
    setIsAgentDone(true);
    setMessages((prev) => finalizeStreaming(prev));
  }, []);

  const clearConversation = useCallback(() => {
    const nextConversationId = makeConversationId();
    setConversationId(nextConversationId);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setIsAgentDone(true);
  }, []);

  return {
    conversationId,
    messages,
    error,
    isConfigured,
    isConnecting,
    isStreaming,
    isAgentDone,
    sendMessage,
    stop,
    clearConversation,
  };
}
