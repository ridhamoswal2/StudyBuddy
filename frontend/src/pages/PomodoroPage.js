import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Zap, Coffee, Clock3, Play, Pause, RotateCcw, SkipForward } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "studybuddy-pomodoro-state-v1";

const MODES = {
  focus: { label: "Focus", minutes: 25, color: "#FF6B6B", icon: Zap },
  short_break: { label: "Short Break", minutes: 5, color: "#B2F5EA", icon: Coffee },
  long_break: { label: "Long Break", minutes: 15, color: "#C3B1E1", icon: Clock3 },
};

function formatTime(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const min = String(Math.floor(safe / 60)).padStart(2, "0");
  const sec = String(safe % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

export default function PomodoroPage() {
  const [mode, setMode] = useState("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [focusSessionsInCycle, setFocusSessionsInCycle] = useState(0);
  const [stats, setStats] = useState({
    today_focus_minutes: 0,
    total_sessions: 0,
    total_focus_hours: 0,
    avg_daily_focus_minutes: 0,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.mode && MODES[parsed.mode]) setMode(parsed.mode);
      if (typeof parsed.remainingSeconds === "number") setRemainingSeconds(Math.max(0, parsed.remainingSeconds));
      if (typeof parsed.running === "boolean") setRunning(parsed.running);
      if (typeof parsed.focusSessionsInCycle === "number") setFocusSessionsInCycle(parsed.focusSessionsInCycle);
    } catch {
      // ignore invalid local state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode, remainingSeconds, running, focusSessionsInCycle })
    );
  }, [mode, remainingSeconds, running, focusSessionsInCycle]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pomodoro/stats`);
      setStats(res.data);
    } catch (e) {
      console.error("Failed to fetch pomodoro stats", e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = window.setInterval(fetchStats, 20000);
    return () => window.clearInterval(id);
  }, [fetchStats]);

  const modeConfig = MODES[mode];
  const ModeIcon = modeConfig.icon;

  const switchMode = (nextMode) => {
    const cfg = MODES[nextMode];
    setMode(nextMode);
    setRunning(false);
    setRemainingSeconds(cfg.minutes * 60);
  };

  const completeCurrentSession = useCallback(async (sessionMode, elapsedSeconds) => {
    if (elapsedSeconds <= 0) return;
    try {
      await axios.post(`${API}/pomodoro/session/complete`, {
        mode: sessionMode,
        duration_seconds: elapsedSeconds,
      });
      fetchStats();
    } catch (e) {
      console.error("Failed to save pomodoro session", e);
    }
  }, [fetchStats]);

  useEffect(() => {
    if (remainingSeconds > 0 || !running) return;
    const finishedMode = mode;
    const elapsedSeconds = MODES[finishedMode].minutes * 60;
    setRunning(false);
    completeCurrentSession(finishedMode, elapsedSeconds);

    if (finishedMode === "focus") {
      setFocusSessionsInCycle((prev) => {
        const nextCount = prev + 1;
        if (nextCount % 4 === 0) {
          switchMode("long_break");
        } else {
          switchMode("short_break");
        }
        return nextCount;
      });
    } else {
      switchMode("focus");
    }
  }, [remainingSeconds, running, mode, completeCurrentSession]);

  const handleReset = () => {
    setRunning(false);
    setRemainingSeconds(MODES[mode].minutes * 60);
  };

  const handleSkip = () => {
    setRunning(false);
    if (mode === "focus") {
      const nextCount = focusSessionsInCycle + 1;
      setFocusSessionsInCycle(nextCount);
      switchMode(nextCount % 4 === 0 ? "long_break" : "short_break");
      return;
    }
    switchMode("focus");
  };

  const progressPercent = useMemo(() => {
    const total = MODES[mode].minutes * 60;
    return Math.min(100, Math.max(0, ((total - remainingSeconds) / total) * 100));
  }, [mode, remainingSeconds]);

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto" data-testid="pomodoro-page">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2">Pomodoro Timer</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
          Stay Focused
        </h1>
        <p className="text-base text-[#52525B] mt-2">Use the Pomodoro technique to boost productivity</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {Object.entries(MODES).map(([key, value]) => (
          <button
            key={key}
            data-testid={`pomodoro-mode-${key}`}
            onClick={() => switchMode(key)}
            className="px-4 py-2 border-2 border-[#0A0A0A] font-bold text-sm neo-btn flex items-center gap-2"
            style={{ background: mode === key ? value.color : "#FFFFFF" }}
          >
            <value.icon size={14} strokeWidth={2.5} />
            {value.label}
          </button>
        ))}
      </div>

      <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-6 md:p-10 mb-8">
        <div className="w-48 h-48 mx-auto rounded-full border-4 border-[#F3F4F6] flex flex-col items-center justify-center mb-6 relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${modeConfig.color} ${progressPercent}%, transparent ${progressPercent}% 100%)`,
              opacity: 0.2,
            }}
          />
          <ModeIcon size={18} strokeWidth={2.5} className="relative z-10 mb-2" />
          <p className="text-5xl font-extrabold relative z-10" style={{ fontFamily: "Outfit, sans-serif" }}>
            {formatTime(remainingSeconds)}
          </p>
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] relative z-10">{modeConfig.label}</p>
        </div>

        <div className="flex justify-center gap-3">
          <button
            data-testid="pomodoro-reset-btn"
            onClick={handleReset}
            className="w-11 h-11 border-2 border-[#0A0A0A] bg-white flex items-center justify-center neo-btn"
          >
            <RotateCcw size={16} strokeWidth={2.5} />
          </button>
          <button
            data-testid="pomodoro-toggle-btn"
            onClick={() => setRunning((prev) => !prev)}
            className="px-7 py-3 border-2 border-[#0A0A0A] font-bold text-sm neo-btn flex items-center gap-2"
            style={{ background: modeConfig.color }}
          >
            {running ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            data-testid="pomodoro-skip-btn"
            onClick={handleSkip}
            className="w-11 h-11 border-2 border-[#0A0A0A] bg-white flex items-center justify-center neo-btn"
          >
            <SkipForward size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        {[0, 1, 2, 3].map((slot) => (
          <div
            key={slot}
            className="w-4 h-4 border-2 border-[#0A0A0A]"
            style={{ background: slot < (focusSessionsInCycle % 4) ? "#FFDE59" : "#FFFFFF" }}
          />
        ))}
        <span className="text-xs font-bold text-[#52525B] ml-2">{stats.total_sessions} sessions</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="pomodoro-stats-grid">
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-4">
          <p className="text-2xl font-extrabold">{stats.today_focus_minutes} min</p>
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Today</p>
        </div>
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-4">
          <p className="text-2xl font-extrabold">{stats.total_sessions}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Total Sessions</p>
        </div>
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-4">
          <p className="text-2xl font-extrabold">{stats.total_focus_hours} hrs</p>
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Total Focus</p>
        </div>
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-4">
          <p className="text-2xl font-extrabold">{stats.avg_daily_focus_minutes} min</p>
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Avg/Day</p>
        </div>
      </div>

      <div className="bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-4">
        <p className="text-sm font-bold mb-2">How Pomodoro Works</p>
        <p className="text-xs font-medium">
          Focus for 25 minutes, then take a 5 minute break. After 4 focus sessions, take a longer 15 minute break.
        </p>
      </div>
    </div>
  );
}
