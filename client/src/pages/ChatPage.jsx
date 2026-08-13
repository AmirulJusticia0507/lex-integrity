import React, { useState, useEffect } from 'react';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('Chat page loaded');
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { type: 'user', content: input, id: Date.now() }]);
    setInput('');

    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat dengan AI</h1>
          <p className="text-sm text-gray-500">Berdasarkan peraturan hukum Indonesia</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg h-[500px] w-full overflow-hidden">
          <div className="p-4">
            {messages.map((msg) => {
              if (msg.type === 'typing') {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center justify-center py-2 text-sm text-gray-400"
                  >
                    <span>AI sedang mengetik...</span>
                  </div>
                );
              }

              const isUser = msg.type === 'user';
              const bgClass = isUser ? 'bg-blue-500' : 'bg-gray-200';
              const textClass = isUser ? 'text-white' : 'text-gray-800';

              return (
                <div key={msg.id} className="flex items-start">
                  <div className={`max-w-[80%] px-4 py-2 rounded-lg ${bgClass}`}>
                    <p className={textClass}>{msg.content}</p>
                  </div>
                  <div className="ml-3 w-6 h-6 rounded-full flex items-center justify-center">
                    {isUser ? 'U' : 'A'}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center justify-center py-2 text-sm text-gray-400">
                <span>AI sedang berpikir...</span>
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={sendMessage}
          className="mt-6 bg-white rounded-2xl p-4 shadow-sm border-t border-gray-200"
        >
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tanyakan tentang peraturan..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Kirim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;