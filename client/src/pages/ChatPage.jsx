import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Scale, User, Bot, Send, Trash2, MessageSquare } from 'lucide-react';

const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const ruleId = searchParams.get('rule_id');
  const ruleCode = searchParams.get('rule_code');
  const ruleTitle = searchParams.get('title');

  const storageKey = useRef('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    storageKey.current = `lex_chat_history_${yyyy}-${mm}-${dd}`;

    try {
      const saved = localStorage.getItem(storageKey.current);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Gagal memuat riwayat percakapan:', e);
    }
  }, []);

  useEffect(() => {
    try {
      if (storageKey.current) {
        localStorage.setItem(storageKey.current, JSON.stringify(messages));
      }
    } catch (e) {
      console.error('Gagal menyimpan riwayat percakapan:', e);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { type: 'user', content: input, id: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

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

      if (data.success && data.data && data.data.response) {
        setMessages((prev) => [...prev, {
          type: 'assistant',
          content: data.data.response,
          id: Date.now() + 1000
        }]);
      } else {
        setMessages((prev) => [...prev, {
          type: 'assistant',
          content: 'Maaf, tidak dapat mendapatkan respons dari AI. Coba lagi nanti.',
          id: Date.now() + 1001
        }]);
        console.error('Chat response error:', data);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, {
        type: 'assistant',
        content: 'Tidak dapat terhubung ke server',
        id: Date.now() + 1002
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearToday = () => {
    if (confirm('Hapus seluruh percakapan hari ini?')) {
      setMessages([]);
      try {
        localStorage.removeItem(storageKey.current);
      } catch (e) {
        console.error('Gagal menghapus riwayat:', e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
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
            {messages.length > 0 && (
              <button
                onClick={clearToday}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 transition-colors dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                Hapus Percakapan Hari Ini
              </button>
            )}
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
                <p className="text-sm">Percakapan hari ini akan tersimpan otomatis</p>
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
                      <User className="h-4 w-4 text-white" />
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