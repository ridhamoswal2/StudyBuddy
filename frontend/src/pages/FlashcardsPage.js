import { useState, useEffect } from "react";
import axios from "axios";
import { Layers, ChevronLeft, ChevronRight, RotateCcw, Loader2, Check, ArrowLeft, Clock, Star } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const QUALITY_LABELS = [
  { value: 0, label: "Again", color: "#FF6B6B", desc: "Completely forgot" },
  { value: 3, label: "Hard", color: "#FFDE59", desc: "Correct, with effort" },
  { value: 4, label: "Good", color: "#B2F5EA", desc: "Correct, some hesitation" },
  { value: 5, label: "Easy", color: "#C3B1E1", desc: "Perfect recall" },
];

export default function FlashcardsPage() {
  const [view, setView] = useState("generate");
  const [topic, setTopic] = useState("");
  const [numCards, setNumCards] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [sets, setSets] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState(new Set());
  const [dueCards, setDueCards] = useState([]);
  const [studyMode, setStudyMode] = useState("all"); // "all" or "due"

  useEffect(() => {
    fetchSets();
  }, []);

  const fetchSets = async () => {
    try {
      const res = await axios.get(`${API}/flashcards/sets`, { withCredentials: true });
      setSets(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const generateFlashcards = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/flashcards/generate`, { topic: topic.trim(), num_cards: numCards }, { withCredentials: true });
      setActiveSet(res.data);
      setCurrentCard(0);
      setFlipped(false);
      setMastered(new Set());
      setStudyMode("all");
      setView("study");
      fetchSets();
    } catch (e) {
      console.error("Failed to generate flashcards", e);
    } finally {
      setGenerating(false);
    }
  };

  const openSet = async (set) => {
    setActiveSet(set);
    setCurrentCard(0);
    setFlipped(false);
    setMastered(new Set());
    // Fetch due cards
    try {
      const res = await axios.get(`${API}/flashcards/sets/${set.id}/due`, { withCredentials: true });
      setDueCards(res.data.due_indices || []);
    } catch (e) {
      setDueCards([]);
    }
    setStudyMode("all");
    setView("study");
  };

  const getStudyCards = () => {
    if (!activeSet) return [];
    if (studyMode === "due" && dueCards.length > 0) return dueCards;
    return activeSet.cards.map((_, i) => i);
  };

  const studyCardIndices = getStudyCards();
  const currentStudyIndex = studyCardIndices[currentCard] ?? 0;

  const nextCard = () => {
    if (!activeSet) return;
    setFlipped(false);
    setTimeout(() => {
      setCurrentCard((currentCard + 1) % studyCardIndices.length);
    }, 100);
  };

  const prevCard = () => {
    if (!activeSet) return;
    setFlipped(false);
    setTimeout(() => {
      setCurrentCard((currentCard - 1 + studyCardIndices.length) % studyCardIndices.length);
    }, 100);
  };

  const reviewCard = async (quality) => {
    if (!activeSet) return;
    try {
      const res = await axios.post(`${API}/flashcards/sets/${activeSet.id}/review`, {
        card_index: currentStudyIndex,
        quality
      }, { withCredentials: true });
      
      // Update local state
      const updated = { ...activeSet };
      const card = updated.cards[currentStudyIndex];
      card.ease_factor = res.data.updated.ease_factor;
      card.interval = res.data.updated.interval;
      card.repetitions = res.data.updated.repetitions;
      card.next_review = res.data.updated.next_review;
      updated.mastered_count = res.data.mastered_count;
      setActiveSet(updated);
      
      if (quality >= 3) {
        const newMastered = new Set(mastered);
        newMastered.add(currentStudyIndex);
        setMastered(newMastered);
      }
      
      // Auto-advance after review
      setFlipped(false);
      setTimeout(() => {
        if (currentCard < studyCardIndices.length - 1) {
          setCurrentCard(currentCard + 1);
        }
      }, 300);
    } catch (e) {
      console.error("Review failed", e);
    }
  };

  // Generate view
  if (view === "generate") {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto" data-testid="flashcards-generate-page">
        <div className="mb-8 animate-slide-up">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2">Flashcards</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Study Smarter
          </h1>
          <p className="text-base text-[#52525B] mt-2">Generate flashcards with AI-powered spaced repetition</p>
        </div>

        <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-6 md:p-8 mb-8 animate-slide-up stagger-1" data-testid="flashcard-form">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider block mb-2">Topic</label>
              <input
                data-testid="flashcard-topic-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Spanish Vocabulary, Human Anatomy, React Hooks..."
                className="w-full bg-white border-2 border-[#0A0A0A] p-4 text-sm font-medium focus:outline-none focus:shadow-[4px_4px_0px_#0A0A0A] transition-shadow"
              />
            </div>
            <div>
              <label className="text-sm font-bold uppercase tracking-wider block mb-2">Number of Cards</label>
              <div className="flex gap-2">
                {[5, 8, 10, 15].map(n => (
                  <button
                    key={n}
                    data-testid={`num-cards-${n}`}
                    onClick={() => setNumCards(n)}
                    className={`border-2 border-[#0A0A0A] px-4 py-2 text-sm font-bold neo-btn ${
                      numCards === n ? "bg-[#FFDE59] shadow-[3px_3px_0px_#0A0A0A]" : "bg-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              data-testid="generate-flashcards-btn"
              onClick={generateFlashcards}
              disabled={!topic.trim() || generating}
              className="bg-[#B2F5EA] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-8 py-3 font-bold text-sm neo-btn disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <><Loader2 size={18} strokeWidth={2.5} className="animate-spin" /> Generating...</>
              ) : (
                <><Layers size={18} strokeWidth={2.5} /> Generate Flashcards</>
              )}
            </button>
          </div>
        </div>

        {/* Past sets with due card counts */}
        {sets.length > 0 && (
          <div className="animate-slide-up stagger-2">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-4">Your Sets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="flashcard-sets">
              {sets.map(s => (
                <button
                  key={s.id}
                  data-testid={`flashcard-set-${s.id}`}
                  onClick={() => openSet(s)}
                  className="neo-card bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-5 text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-[#C3B1E1] border-2 border-[#0A0A0A] flex items-center justify-center">
                      <Layers size={16} strokeWidth={2.5} />
                    </div>
                    <p className="font-bold text-sm truncate">{s.topic}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#52525B] font-medium">
                    <span>{s.cards?.length || 0} cards</span>
                    {s.mastered_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={12} strokeWidth={2.5} /> {s.mastered_count} mastered
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Study view with spaced repetition
  if (view === "study" && activeSet) {
    const card = activeSet.cards[currentStudyIndex];
    if (!card) return null;
    const cardInterval = card.interval || 0;

    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto" data-testid="flashcard-study-page">
        <div className="flex items-center justify-between mb-6">
          <button
            data-testid="back-to-sets-btn"
            onClick={() => { setView("generate"); fetchSets(); }}
            className="flex items-center gap-2 bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-4 py-2 font-bold text-sm neo-btn"
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
          <div className="flex gap-2">
            {dueCards.length > 0 && (
              <button
                data-testid="study-due-btn"
                onClick={() => { setStudyMode(studyMode === "due" ? "all" : "due"); setCurrentCard(0); setFlipped(false); }}
                className={`border-2 border-[#0A0A0A] px-3 py-2 text-xs font-bold neo-btn flex items-center gap-1 ${
                  studyMode === "due" ? "bg-[#FF6B6B] shadow-[3px_3px_0px_#0A0A0A]" : "bg-white"
                }`}
              >
                <Clock size={14} strokeWidth={2.5} /> {dueCards.length} Due
              </button>
            )}
            <span className="bg-[#C3B1E1] border-2 border-[#0A0A0A] px-4 py-2 text-sm font-bold">
              {currentCard + 1} / {studyCardIndices.length}
            </span>
          </div>
        </div>

        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2 text-center">{activeSet.topic}</p>
        
        {/* Card schedule info */}
        <div className="flex justify-center gap-4 mb-4 text-xs text-[#52525B] font-medium">
          <span className="flex items-center gap-1">
            <Clock size={12} /> Interval: {cardInterval}d
          </span>
          <span>EF: {(card.ease_factor || 2.5).toFixed(1)}</span>
          <span>Reps: {card.repetitions || 0}</span>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {studyCardIndices.map((ci, i) => (
            <button
              key={i}
              onClick={() => { setFlipped(false); setTimeout(() => setCurrentCard(i), 100); }}
              className={`w-3 h-3 border-2 border-[#0A0A0A] transition-all ${
                i === currentCard ? "bg-[#FFDE59] scale-125" :
                mastered.has(ci) ? "bg-[#B2F5EA]" : "bg-white"
              }`}
              data-testid={`card-dot-${i}`}
            />
          ))}
        </div>

        {/* Flashcard */}
        <div
          className="cursor-pointer mb-6"
          style={{ perspective: '1000px', height: '300px' }}
          onClick={() => setFlipped(!flipped)}
          data-testid="flashcard"
        >
          <div className={`flashcard-inner w-full h-full ${flipped ? 'flipped' : ''}`}>
            <div className="flashcard-front w-full h-full bg-white border-2 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] flex flex-col items-center justify-center p-8" data-testid="flashcard-front">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#52525B] mb-4">Question</p>
              <p className="text-lg sm:text-xl font-bold text-center leading-relaxed" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {card.front}
              </p>
              <p className="text-xs text-[#52525B] mt-6 font-medium">Click to flip</p>
            </div>
            <div className="flashcard-back w-full h-full bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] flex flex-col items-center justify-center p-8" data-testid="flashcard-back">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A] mb-4">Answer</p>
              <p className="text-base sm:text-lg font-medium text-center leading-relaxed">
                {card.back}
              </p>
            </div>
          </div>
        </div>

        {/* Spaced repetition review buttons */}
        {flipped && (
          <div className="mb-4 animate-slide-up" data-testid="review-buttons">
            <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] text-center mb-3">How well did you know this?</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {QUALITY_LABELS.map(q => (
                <button
                  key={q.value}
                  data-testid={`review-${q.label.toLowerCase()}`}
                  onClick={() => reviewCard(q.value)}
                  className="border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-4 py-2 font-bold text-xs neo-btn"
                  style={{ background: q.color }}
                  title={q.desc}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-center gap-3">
          <button data-testid="prev-card-btn" onClick={prevCard} className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-3 neo-btn">
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <button data-testid="next-card-btn" onClick={nextCard} className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-3 neo-btn">
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-center text-sm font-bold text-[#52525B] mt-4" data-testid="mastered-count">
          {activeSet.mastered_count || 0} / {activeSet.cards.length} mastered (21+ day interval)
        </p>
      </div>
    );
  }

  return null;
}
