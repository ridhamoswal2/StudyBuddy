import { useState, useEffect } from "react";
import axios from "axios";
import { HelpCircle, ChevronRight, CheckCircle, XCircle, RotateCcw, Loader2, Trophy, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DIFFICULTIES = ["easy", "medium", "hard"];

export default function QuizPage() {
  const [view, setView] = useState("generate"); // "generate", "quiz", "results", "history"
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/quiz/list`);
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const generateQuiz = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/quiz/generate`, { topic: topic.trim(), difficulty, num_questions: numQuestions });
      setQuiz(res.data);
      setAnswers(new Array(res.data.questions.length).fill(-1));
      setCurrentQ(0);
      setResults(null);
      setView("quiz");
    } catch (e) {
      console.error("Failed to generate quiz", e);
    } finally {
      setGenerating(false);
    }
  };

  const selectAnswer = (qIndex, aIndex) => {
    if (results) return;
    const newAnswers = [...answers];
    newAnswers[qIndex] = aIndex;
    setAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/quiz/${quiz.id}/submit`, { answers });
      setResults(res.data);
      setView("results");
      fetchHistory();
    } catch (e) {
      console.error("Failed to submit quiz", e);
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setAnswers([]);
    setResults(null);
    setCurrentQ(0);
    setView("generate");
    setTopic("");
  };

  // Generate view
  if (view === "generate") {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto" data-testid="quiz-generate-page">
        <div className="mb-8 animate-slide-up">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2">Quizzes</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Test Your Knowledge
          </h1>
          <p className="text-base text-[#52525B] mt-2">Generate AI-powered quizzes on any topic</p>
        </div>

        {/* Generate form */}
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-6 md:p-8 mb-8 animate-slide-up stagger-1" data-testid="quiz-form">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider block mb-2">Topic</label>
              <input
                data-testid="quiz-topic-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Photosynthesis, World War II, Python Programming..."
                className="w-full bg-white border-2 border-[#0A0A0A] p-4 text-sm font-medium focus:outline-none focus:shadow-[4px_4px_0px_#0A0A0A] transition-shadow"
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="text-sm font-bold uppercase tracking-wider block mb-2">Difficulty</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="quiz-difficulty-dropdown"
                      className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-5 py-3 text-sm font-bold capitalize neo-btn"
                    >
                      {difficulty}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] rounded-none bg-white">
                    {DIFFICULTIES.map(d => (
                      <DropdownMenuItem
                        key={d}
                        data-testid={`difficulty-${d}`}
                        onClick={() => setDifficulty(d)}
                        className="font-bold capitalize cursor-pointer hover:bg-[#FFDE59] rounded-none"
                      >
                        {d}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-sm font-bold uppercase tracking-wider block mb-2">Questions</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="quiz-num-dropdown"
                      className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-5 py-3 text-sm font-bold neo-btn"
                    >
                      {numQuestions}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] rounded-none bg-white">
                    {[3, 5, 8, 10].map(n => (
                      <DropdownMenuItem
                        key={n}
                        data-testid={`num-questions-${n}`}
                        onClick={() => setNumQuestions(n)}
                        className="font-bold cursor-pointer hover:bg-[#FFDE59] rounded-none"
                      >
                        {n} questions
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <button
              data-testid="generate-quiz-btn"
              onClick={generateQuiz}
              disabled={!topic.trim() || generating}
              className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-8 py-3 font-bold text-sm neo-btn disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <><Loader2 size={18} strokeWidth={2.5} className="animate-spin" /> Generating...</>
              ) : (
                <><HelpCircle size={18} strokeWidth={2.5} /> Generate Quiz</>
              )}
            </button>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="animate-slide-up stagger-2">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-4">Past Quizzes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="quiz-history">
              {history.slice(0, 6).map(q => (
                <div key={q.id} className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-5 neo-card" data-testid={`quiz-history-${q.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{q.topic}</p>
                      <p className="text-xs text-[#52525B] mt-1 capitalize">{q.difficulty} &middot; {q.questions?.length || 0} questions</p>
                    </div>
                    {q.completed && q.score != null && (
                      <span className={`border-2 border-[#0A0A0A] px-3 py-1 text-xs font-bold ${
                        (q.score / q.total * 100) >= 70 ? "bg-[#B2F5EA]" : "bg-[#FF6B6B]"
                      }`}>
                        {q.score}/{q.total}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Quiz view
  if (view === "quiz" && quiz) {
    const q = quiz.questions[currentQ];
    const allAnswered = answers.every(a => a !== -1);

    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto" data-testid="quiz-taking-page">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B]">{quiz.topic}</p>
            <p className="text-xs text-[#52525B] capitalize">{quiz.difficulty}</p>
          </div>
          <span className="bg-[#C3B1E1] border-2 border-[#0A0A0A] px-4 py-2 text-sm font-bold">
            {currentQ + 1} / {quiz.questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-white border-2 border-[#0A0A0A] mb-8">
          <div
            className="h-full bg-[#FFDE59] transition-all duration-300"
            style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-6 md:p-8 mb-6 animate-slide-up" data-testid="quiz-question-card">
          <h3 className="text-lg sm:text-xl font-extrabold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {q.question}
          </h3>
          <div className="space-y-3">
            {q.options.map((option, oi) => (
              <button
                key={oi}
                data-testid={`quiz-option-${oi}`}
                onClick={() => selectAnswer(currentQ, oi)}
                className={`quiz-option w-full text-left p-4 border-2 border-[#0A0A0A] font-medium text-sm ${
                  answers[currentQ] === oi ? "selected" : "bg-white"
                }`}
              >
                <span className="inline-block w-7 h-7 border-2 border-[#0A0A0A] text-center leading-[1.5rem] font-bold text-xs mr-3"
                  style={{ background: answers[currentQ] === oi ? "#0A0A0A" : "transparent", color: answers[currentQ] === oi ? "#FFDE59" : "#0A0A0A" }}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            data-testid="quiz-prev-btn"
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-5 py-3 font-bold text-sm neo-btn disabled:opacity-30"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>

          <div className="flex gap-2">
            {quiz.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 border-2 border-[#0A0A0A] text-xs font-bold transition-all ${
                  i === currentQ ? "bg-[#FFDE59] shadow-[3px_3px_0px_#0A0A0A]" :
                  answers[i] !== -1 ? "bg-[#B2F5EA]" : "bg-white"
                }`}
                data-testid={`quiz-nav-${i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQ < quiz.questions.length - 1 ? (
            <button
              data-testid="quiz-next-btn"
              onClick={() => setCurrentQ(currentQ + 1)}
              className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-5 py-3 font-bold text-sm neo-btn flex items-center gap-2"
            >
              Next <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              data-testid="submit-quiz-btn"
              onClick={submitQuiz}
              disabled={!allAnswered || submitting}
              className="bg-[#B2F5EA] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-6 py-3 font-bold text-sm neo-btn disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} strokeWidth={2.5} />}
              Submit
            </button>
          )}
        </div>
      </div>
    );
  }

  // Results view
  if (view === "results" && results && quiz) {
    const pct = results.percentage;
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto" data-testid="quiz-results-page">
        {/* Score card */}
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] p-8 text-center mb-8 animate-slide-up">
          <div className={`w-20 h-20 border-2 border-[#0A0A0A] flex items-center justify-center mx-auto mb-4 ${pct >= 70 ? 'bg-[#B2F5EA]' : 'bg-[#FF6B6B]'}`}>
            <Trophy size={36} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {results.score} / {results.total}
          </h2>
          <p className="text-lg font-bold mt-1">{pct}%</p>
          <p className="text-sm text-[#52525B] mt-2">
            {pct >= 90 ? "Excellent work!" : pct >= 70 ? "Good job!" : pct >= 50 ? "Keep practicing!" : "Time to study more!"}
          </p>
        </div>

        {/* Review */}
        <div className="space-y-4 mb-8">
          {results.results.map((r, i) => (
            <div key={i} className={`border-2 border-[#0A0A0A] p-5 ${r.is_correct ? "bg-[#B2F5EA]" : "bg-[#FF6B6B]"} shadow-[3px_3px_0px_#0A0A0A]`} data-testid={`result-${i}`}>
              <div className="flex items-start gap-3">
                {r.is_correct ? <CheckCircle size={20} strokeWidth={2.5} /> : <XCircle size={20} strokeWidth={2.5} />}
                <div>
                  <p className="font-bold text-sm">{quiz.questions[i].question}</p>
                  {!r.is_correct && (
                    <p className="text-xs mt-1 font-medium">
                      Correct: {quiz.questions[i].options[r.correct]}
                    </p>
                  )}
                  {r.explanation && <p className="text-xs mt-2 opacity-80">{r.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          data-testid="try-again-btn"
          onClick={resetQuiz}
          className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] px-8 py-3 font-bold text-sm neo-btn flex items-center gap-2"
        >
          <RotateCcw size={18} strokeWidth={2.5} /> New Quiz
        </button>
      </div>
    );
  }

  return null;
}
