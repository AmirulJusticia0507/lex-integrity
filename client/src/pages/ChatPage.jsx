import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Scale, UserCircle, Bot, Send, Trash2, MessageSquare, Plus, Cpu, Sparkles, AlertCircle } from 'lucide-react';
import { apiConfig } from '../config';

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ruleId = searchParams.get('rule_id');
  const ruleCode = searchParams.get('rule_code');
  const ruleTitle = searchParams.get('title');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('lex-integrity-agent:latest');
  const messagesEndRef = useRef(null);

  const SESSIONS_KEY = 'lex_chat_sessions';

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const quickPrompts = [
    'Apa saja celah hukum dalam UU Cipta Kerja bagi pekerja?',
    'Bagaimana sanksi administratif dan pidana terkait pelanggaran tata ruang?',
    'Analisis potensi diskresi berlebihan dalam Perda Sleman.',
    'Jelaskan hak-hak masyarakat adat berdasarkan UU Lingkungan Hidup.'
  ];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
        }
      }
    } catch (e) {
      console.error('Gagal memuat sesi chat:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Gagal menyimpan sesi chat:', e);
    }
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const createNewSession = (initialMessages = [], ruleContext = null) => {
    const now = new Date().toISOString();
    const title = initialMessages.length > 0
      ? initialMessages.find(m => m.type === 'user')?.content?.slice(0, 40) || 'Percakapan Baru'
      : 'Percakapan Baru';

    const newSession = {
      id: Date.now().toString(),
      title,
      messages: initialMessages,
      ruleContext,
      createdAt: now,
      updatedAt: now,
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages(initialMessages);
    return newSession;
  };

  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    if (session.ruleContext) {
      const params = new URLSearchParams();
      if (session.ruleContext.rule_id) params.set('rule_id', session.ruleContext.rule_id);
      if (session.ruleContext.rule_code) params.set('rule_code', session.ruleContext.rule_code);
      if (session.ruleContext.title) params.set('title', session.ruleContext.title);
      navigate(`/chat?${params.toString()}`, { replace: true });
    }
  };

  const updateSession = (sessionId, updates) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  };

  const handleNewChat = () => {
    createNewSession([], ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
  };

  const handleQuickPrompt = (promptText) => {
    setInput(promptText);
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    const userMessage = { type: 'user', content: userQuery, id: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    let sessionToUpdate = currentSessionId;
    if (!sessionToUpdate) {
      const created = createNewSession(newMessages, ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
      sessionToUpdate = created.id;
    } else {
      updateSession(sessionToUpdate, { messages: newMessages, title: userQuery.slice(0, 40) });
    }

    setIsLoading(true);

    try {
      const apiEndpoint = `${apiConfig.baseURL || ''}/api/chat`;

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          rule_id: ruleId,
          history: newMessages.slice(-6)
        }),
      });

      const data = await response.json();

      if (data.data?.model) {
        setActiveModel(data.data.model);
      }

      const replyContent = data.success && data.data?.response
        ? data.data.response
        : (data.error || 'Maaf, tidak dapat mendapatkan respons dari Lex Integrity Agent.');

      const assistantMessage = {
        type: 'assistant',
        content: replyContent,
        id: Date.now() + 1000,
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      if (sessionToUpdate) {
        updateSession(sessionToUpdate, { messages: updatedMessages });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        type: 'assistant',
        content: 'Gagal terhubung ke server backend atau Ollama lokal.',
        id: Date.now() + 1000,
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      if (sessionToUpdate) {
        updateSession(sessionToUpdate, { messages: updatedMessages });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chat AI — Lex Integrity Agent</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <Cpu className="h-3 w-3" />
                    {activeModel}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Asisten AI Kepatuhan Hukum Lokal (DeepSeek-R1 14b) — Berempati, Adil & Berintegritas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Percakapan Baru
              </button>
              {messages.length > 0 && currentSessionId && (
                <button
                  onClick={() => {
                    setSessions(prev => prev.filter(s => s.id !== currentSessionId));
                    createNewSession([], ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium dark:text-red-400 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus Chat
                </button>
              )}
            </div>
          </div>

          {ruleTitle && (
            <div className="mt-4 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3.5 dark:bg-gray-700/60 dark:border-blue-900">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0 dark:text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Fokus Konteks Peraturan: {ruleTitle}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-mono mt-0.5">Kode Regulasi: {ruleCode}</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages Container */}
        <div className="bg-white rounded-2xl shadow-lg h-[calc(100vh-320px)] min-h-[460px] w-full overflow-hidden dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 bg-blue-50 dark:bg-gray-700/80 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 dark:border-gray-600">
                  <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                  Konsultasi Hukum Lokal dengan Lex Integrity Agent
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
                  {ruleTitle ? `Tanyakan analisis pasal atau celah hukum untuk "${ruleTitle}"` : 'Tanyakan analisis kontradiksi hukum, celah diskresi, atau dampak kemanusiaan.'}
                </p>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-2xl w-full">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="text-left text-xs text-gray-700 dark:text-gray-300 bg-gray-50 hover:bg-blue-50 dark:bg-gray-700/50 dark:hover:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all font-medium flex items-center justify-between group"
                    >
                      <span>{prompt}</span>
                      <Send className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.type === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                    isUser ? 'bg-gray-800 dark:bg-gray-600 text-white' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
                  }`}>
                    {isUser ? (
                      <UserCircle className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>
                  <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl shadow-sm leading-relaxed text-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-tl-none border border-gray-200/60 dark:border-gray-600/60'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-none px-5 py-4 border border-gray-200/60 dark:border-gray-600/60 flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Lex Integrity Agent sedang berpikir…</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder={ruleTitle ? `Tanyakan analisis tentang "${ruleTitle}"...` : 'Tanyakan seputar isu hukum, kontradiksi regulasi, atau celah kebijakan...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
              >
                <Send className="h-4 w-4" />
                <span>Kirim</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;