import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Scale, UserCircle, Bot, Send, Trash2, MessageSquare, Plus, Clock, X, Menu, ScrollText } from 'lucide-react';

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ruleId = searchParams.get('rule_id');
  const ruleCode = searchParams.get('rule_code');
  const ruleTitle = searchParams.get('title');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const SESSIONS_KEY = 'lex_chat_sessions';

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

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

  const deleteSession = (sessionId) => {
    if (confirm('Hapus percakapan ini?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        createNewSession([], ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
      }
    }
  };

  const handleNewChat = () => {
    createNewSession([], ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { type: 'user', content: input, id: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    if (!currentSessionId) {
      createNewSession(newMessages, ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
    } else {
      updateSession(currentSessionId, { messages: newMessages, title: userMessage.content.slice(0, 40) });
    }

    setIsLoading(true);
    try {
      const context = ruleTitle
        ? `Anda sedang bertanya tentang peraturan berikut:\nKode: ${ruleCode}\nJudul: ${ruleTitle}\n\nPertanyaan: ${input}`
        : input;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: context, rule_id: ruleId }),
      });
      const data = await response.json();

      const assistantMessage = {
        type: 'assistant',
        content: data.success && data.data?.response ? data.data.response : 'Maaf, tidak dapat mendapatkan respons dari AI.',
        id: Date.now() + 1000,
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      if (currentSessionId) {
        updateSession(currentSessionId, { messages: updatedMessages });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        type: 'assistant',
        content: 'Tidak dapat terhubung ke server',
        id: Date.now() + 1000,
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      if (currentSessionId) {
        updateSession(currentSessionId, { messages: updatedMessages });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Hari ini, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === yesterday.toDateString()) return 'Kemarin, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg dark:bg-gray-800 animate-fade-slide-down">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chat dengan AI</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Berdasarkan peraturan hukum Indonesia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Baru
              </button>
              {messages.length > 0 && currentSessionId && (
                <button
                  onClick={() => {
                    setSessions(prev => prev.filter(s => s.id !== currentSessionId));
                    createNewSession([], ruleId ? { rule_id: ruleId, rule_code: ruleCode, title: ruleTitle } : null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              )}
            </div>
          </div>
          {ruleTitle && (
            <div className="mt-4 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 animate-fade-slide-down dark:bg-gray-700 dark:border-orange-900">
              <FileText className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0 dark:text-orange-400" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Menanyakan tentang: {ruleTitle}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Kode: {ruleCode}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg h-[calc(100vh-280px)] min-h-[420px] w-full overflow-hidden dark:bg-gray-800">
          <div className="p-5 overflow-y-auto h-full">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-message-in">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 dark:bg-gray-700">
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                </div>
                <p className="mb-2 text-gray-600 dark:text-gray-300">
                  {ruleTitle ? `Tanyakan tentang "${ruleTitle}"` : 'Tanyakan tentang peraturan...'}
                </p>
                <p className="text-sm">Percakapan tersimpan otomatis di sidebar</p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.type === 'user';
              const bgClass = isUser
                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                : 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm dark:bg-gray-600 dark:text-gray-100';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 mb-4 animate-message-in ${isUser ? 'flex-row-reverse' : ''}`}
                  style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUser ? 'bg-gray-300 dark:bg-gray-500' : 'bg-blue-600'
                  }`}>
                    {isUser ? (
                      <UserCircle className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div className={`max-w-[75%] px-4 py-2.5 shadow-sm ${bgClass}`}>
                    <p className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3 mb-4 animate-message-in">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 dark:bg-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full dark:bg-gray-300"></span>
                    <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full dark:bg-gray-300"></span>
                    <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full dark:bg-gray-300"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form
          onSubmit={sendMessage}
          className="mt-6 bg-white rounded-2xl p-4 shadow-sm border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={ruleTitle ? `Tanyakan tentang "${ruleTitle}"...` : 'Tanyakan tentang peraturan...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              Kirim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;