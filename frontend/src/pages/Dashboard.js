import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MessageSquare, HelpCircle, Layers, FileText, Flame, Trophy, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, actRes, weeklyRes] = await Promise.all([
          axios.get(`${API}/progress/stats`),
          axios.get(`${API}/progress/activity`),
          axios.get(`${API}/progress/weekly`)
        ]);
        setStats(statsRes.data);
        setActivities(actRes.data.slice(0, 8));
        setWeekly(weeklyRes.data);
      } catch (e) {
        console.error("Failed to fetch dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = stats ? [
    { label: "Study Streak", value: `${stats.streak} days`, icon: Flame, color: "#FF6B6B", bg: "#FF6B6B" },
    { label: "Quizzes Done", value: stats.completed_quizzes, icon: Trophy, color: "#FFDE59", bg: "#FFDE59" },
    { label: "Avg Score", value: `${stats.avg_quiz_score}%`, icon: TrendingUp, color: "#B2F5EA", bg: "#B2F5EA" },
    { label: "Total Activities", value: stats.total_activities, icon: Activity, color: "#C3B1E1", bg: "#C3B1E1" },
  ] : [];

  const quickActions = [
    { label: "Ask AI", desc: "Start a chat", icon: MessageSquare, path: "/chat", color: "#B2F5EA" },
    { label: "New Quiz", desc: "Test yourself", icon: HelpCircle, path: "/quizzes", color: "#FFDE59" },
    { label: "Flashcards", desc: "Study cards", icon: Layers, path: "/flashcards", color: "#C3B1E1" },
    { label: "Upload PDF", desc: "Summarize docs", icon: FileText, path: "/documents", color: "#FF6B6B" },
  ];

  const getActivityIcon = (type) => {
    const icons = { chat: MessageSquare, quiz: HelpCircle, flashcard: Layers, document: FileText };
    return icons[type] || Activity;
  };

  if (loading) {
    return (
      <div className="p-8 md:p-12" data-testid="dashboard-loading">
        <div className="space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-white border-2 border-[#0A0A0A] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto" data-testid="dashboard-page">
      {/* Header */}
      <div className="mb-10 animate-slide-up">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-2">Dashboard</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Welcome back
        </h1>
        <p className="text-base text-[#52525B] mt-2">Here's your learning overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10" data-testid="stats-grid">
        {statCards.map((stat, i) => (
          <div
            key={stat.label}
            className={`neo-card bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-5 animate-slide-up stagger-${i+1}`}
            data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 border-2 border-[#0A0A0A] flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={18} strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>{stat.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-[#52525B] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Quick Actions */}
        <div className="md:col-span-1">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-4">Quick Actions</p>
          <div className="space-y-3" data-testid="quick-actions">
            {quickActions.map((action) => (
              <button
                key={action.label}
                data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-4 p-4 bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] neo-btn text-left"
              >
                <div className="w-10 h-10 border-2 border-[#0A0A0A] flex items-center justify-center flex-shrink-0" style={{ background: action.color }}>
                  <action.icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-bold text-sm">{action.label}</p>
                  <p className="text-xs text-[#52525B]">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="md:col-span-2">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-4">Weekly Activity</p>
          <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] p-6" data-testid="weekly-chart">
            {weekly.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekly}>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 700 }} axisLine={{ stroke: '#0A0A0A', strokeWidth: 2 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} axisLine={{ stroke: '#0A0A0A', strokeWidth: 2 }} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ border: '2px solid #0A0A0A', boxShadow: '4px 4px 0px #0A0A0A', borderRadius: 0, fontWeight: 700 }}
                  />
                  <Bar dataKey="count" fill="#FFDE59" stroke="#0A0A0A" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[#52525B] font-bold">
                No activity this week. Start learning!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-10">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#52525B] mb-4">Recent Activity</p>
        <div className="bg-white border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A]" data-testid="recent-activity">
          {activities.length > 0 ? (
            <div className="divide-y-2 divide-[#0A0A0A]">
              {activities.map((a, i) => {
                const Icon = getActivityIcon(a.activity_type);
                return (
                  <div key={a.id || i} className="flex items-center gap-4 p-4">
                    <div className="w-8 h-8 bg-[#FFFDF7] border-2 border-[#0A0A0A] flex items-center justify-center flex-shrink-0">
                      <Icon size={16} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.description}</p>
                      <p className="text-xs text-[#52525B]">
                        {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {a.score != null && (
                      <span className="bg-[#FFDE59] border-2 border-[#0A0A0A] px-3 py-1 text-xs font-bold">{a.score}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-[#52525B] font-bold">
              No activity yet. Start by asking AI a question or taking a quiz!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
