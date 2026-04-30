import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Search, X, MessageSquare, HelpCircle, Layers, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SearchPanel({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/search`, { params: { q: q.trim(), type: "all" }, withCredentials: true });
      setResults(res.data);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalResults = results ? 
    (results.chats?.length || 0) + (results.quizzes?.length || 0) + 
    (results.flashcards?.length || 0) + (results.documents?.length || 0) : 0;

  const goTo = (path) => { navigate(path); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" data-testid="search-panel">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-white border-2 border-[#0A0A0A] shadow-[8px_8px_0px_#0A0A0A] animate-slide-up">
        {/* Search input */}
        <div className="flex items-center border-b-2 border-[#0A0A0A] p-4">
          <Search size={20} strokeWidth={2.5} className="mr-3 text-[#52525B]" />
          <input
            data-testid="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats, quizzes, flashcards, documents..."
            className="flex-1 text-sm font-medium bg-transparent focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="ml-2 p-1 hover:bg-[#FFFDF7]" data-testid="close-search-btn">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-4" data-testid="search-results">
          {loading && <p className="text-sm text-[#52525B] font-medium text-center py-4">Searching...</p>}
          
          {!loading && results && totalResults === 0 && query.trim() && (
            <p className="text-sm text-[#52525B] font-medium text-center py-4">No results found for "{query}"</p>
          )}

          {results?.chats?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] mb-2">Chats</p>
              {results.chats.map(c => (
                <button key={c.id} onClick={() => goTo("/chat")} className="w-full flex items-center gap-3 p-3 text-left border-2 border-transparent hover:border-[#0A0A0A] hover:bg-[#FFFDF7] transition-all mb-1" data-testid={`search-result-chat-${c.id}`}>
                  <MessageSquare size={16} strokeWidth={2.5} className="text-[#52525B] flex-shrink-0" />
                  <span className="text-sm font-bold truncate">{c.title}</span>
                </button>
              ))}
            </div>
          )}

          {results?.quizzes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] mb-2">Quizzes</p>
              {results.quizzes.map(q => (
                <button key={q.id} onClick={() => goTo("/quizzes")} className="w-full flex items-center gap-3 p-3 text-left border-2 border-transparent hover:border-[#0A0A0A] hover:bg-[#FFFDF7] transition-all mb-1" data-testid={`search-result-quiz-${q.id}`}>
                  <HelpCircle size={16} strokeWidth={2.5} className="text-[#52525B] flex-shrink-0" />
                  <div>
                    <span className="text-sm font-bold">{q.topic}</span>
                    <span className="text-xs text-[#52525B] ml-2 capitalize">{q.difficulty}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results?.flashcards?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] mb-2">Flashcards</p>
              {results.flashcards.map(f => (
                <button key={f.id} onClick={() => goTo("/flashcards")} className="w-full flex items-center gap-3 p-3 text-left border-2 border-transparent hover:border-[#0A0A0A] hover:bg-[#FFFDF7] transition-all mb-1" data-testid={`search-result-flashcard-${f.id}`}>
                  <Layers size={16} strokeWidth={2.5} className="text-[#52525B] flex-shrink-0" />
                  <span className="text-sm font-bold">{f.topic} ({f.cards?.length || 0} cards)</span>
                </button>
              ))}
            </div>
          )}

          {results?.documents?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] mb-2">Documents</p>
              {results.documents.map(d => (
                <button key={d.id} onClick={() => goTo("/documents")} className="w-full flex items-center gap-3 p-3 text-left border-2 border-transparent hover:border-[#0A0A0A] hover:bg-[#FFFDF7] transition-all mb-1" data-testid={`search-result-doc-${d.id}`}>
                  <FileText size={16} strokeWidth={2.5} className="text-[#52525B] flex-shrink-0" />
                  <span className="text-sm font-bold truncate">{d.original_filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
