import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadInitialSessions = async () => {
      try {
        const res = await axios.get(`${API}/chat/sessions`);
        setSessions(res.data);
        if (res.data.length > 0) {
          const firstSessionId = res.data[0].id;
          setActiveSession(firstSessionId);
          const msgRes = await axios.get(`${API}/chat/sessions/${firstSessionId}/messages`);
          setMessages(msgRes.data);
        }
      } catch (e) {
        console.error("Failed to fetch sessions", e);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadInitialSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API}/chat/sessions`);
      setSessions(res.data);
      if (res.data.length > 0 && !activeSession) {
        selectSession(res.data[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (sessionId) => {
    setActiveSession(sessionId);
    try {
      const res = await axios.get(`${API}/chat/sessions/${sessionId}/messages`);
      setMessages(res.data);
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  const createSession = async () => {
    try {
      const res = await axios.post(`${API}/chat/sessions`);
      setSessions([res.data, ...sessions]);
      setActiveSession(res.data.id);
      setMessages([]);
    } catch (e) {
      console.error("Failed to create session", e);
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/chat/sessions/${sessionId}`);
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      if (activeSession === sessionId) {
        if (updated.length > 0) {
          selectSession(updated[0].id);
        } else {
          setActiveSession(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    
    let sessionId = activeSession;
    if (!sessionId) {
      try {
        const res = await axios.post(`${API}/chat/sessions`);
        setSessions([res.data, ...sessions]);
        sessionId = res.data.id;
        setActiveSession(sessionId);
      } catch (e) {
        return;
      }
    }

    const userText = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const tempUserMsg = { id: "temp-user", role: "user", content: userText, session_id: sessionId };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await axios.post(`${API}/chat/send`, { session_id: sessionId, message: userText });
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== "temp-user");
        return [...filtered, res.data.user_message, res.data.ai_message];
      });
      // Refresh sessions to update title
      fetchSessions();
    } catch (e) {
      console.error("Failed to send message", e);
      setMessages(prev => prev.filter(m => m.id !== "temp-user"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen" data-testid="chat-page">
      {/* Sessions sidebar */}
      <div className="w-64 border-r-2 border-[#0A0A0A] bg-white flex-shrink-0 flex flex-col hidden md:flex" data-testid="chat-sessions-panel">
        <div className="p-4 border-b-2 border-[#0A0A0A]">
          <button
            data-testid="new-chat-btn"
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-4 py-3 font-bold text-sm neo-btn"
          >
            <Plus size={18} strokeWidth={2.5} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1" data-testid="chat-sessions-list">
          {loadingSessions ? (
            <div className="text-center p-4 text-[#52525B] text-sm font-medium">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center p-4 text-[#52525B] text-sm font-medium">No chats yet</div>
          ) : sessions.map(session => (
            <button
              key={session.id}
              data-testid={`session-${session.id}`}
              onClick={() => selectSession(session.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium border-2 transition-all ${
                activeSession === session.id
                  ? "bg-[#FFDE59] border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A]"
                  : "border-transparent hover:border-[#0A0A0A] hover:bg-[#FFFDF7]"
              }`}
            >
              <MessageSquare size={14} strokeWidth={2.5} className="flex-shrink-0" />
              <span className="truncate flex-1">{session.title}</span>
              <button
                data-testid={`delete-session-${session.id}`}
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 hover:text-[#FF6B6B] flex-shrink-0 p-0.5"
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile new chat */}
        <div className="md:hidden p-3 border-b-2 border-[#0A0A0A] bg-white flex gap-2">
          <button
            data-testid="mobile-new-chat-btn"
            onClick={createSession}
            className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-4 py-2 font-bold text-sm neo-btn"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
          <select
            data-testid="mobile-session-select"
            value={activeSession || ""}
            onChange={(e) => selectSession(e.target.value)}
            className="flex-1 bg-white border-2 border-[#0A0A0A] p-2 text-sm font-bold"
          >
            <option value="">Select a chat</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4" data-testid="chat-messages">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] flex items-center justify-center mb-4">
                <MessageSquare size={28} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Ask me anything</h2>
              <p className="text-[#52525B] text-sm max-w-md">
                I can help you understand concepts, solve problems, explain topics, and more.
              </p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex animate-msg ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] p-4 border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] ${
                  msg.role === "user" ? "bg-[#B2F5EA]" : "bg-white"
                }`}
                data-testid={`message-${msg.role}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-1.5">
                  {msg.role === "user" ? "You" : "StudyBuddy"}
                </p>
                {msg.role === "assistant" ? (
                  <div className="markdown-content text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start animate-msg">
              <div className="bg-white border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-2">StudyBuddy</p>
                <div className="flex gap-1.5">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t-2 border-[#0A0A0A] bg-white p-4 md:p-6">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <textarea
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about any topic..."
              rows={1}
              className="flex-1 bg-white border-2 border-[#0A0A0A] p-4 text-sm font-medium resize-none focus:outline-none focus:shadow-[4px_4px_0px_#0A0A0A] transition-shadow"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              data-testid="send-message-btn"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-5 py-3 font-bold neo-btn disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? <Loader2 size={18} strokeWidth={2.5} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
