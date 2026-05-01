import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BookOpen, MessageSquare, HelpCircle, Layers, FileText, BarChart3, X, Menu, Search, LogOut, Timer } from "lucide-react";

const navItems = [
  { path: "/", icon: BarChart3, label: "Dashboard" },
  { path: "/chat", icon: MessageSquare, label: "AI Chat" },
  { path: "/quizzes", icon: HelpCircle, label: "Quizzes" },
  { path: "/flashcards", icon: Layers, label: "Flashcards" },
  { path: "/documents", icon: FileText, label: "Documents" },
  { path: "/pomodoro", icon: Timer, label: "Pomodoro" },
];

export default function Sidebar({ isOpen, onToggle, onSearchOpen }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile toggle */}
      <button
        data-testid="sidebar-toggle-btn"
        onClick={onToggle}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] p-2 neo-btn"
      >
        {isOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay md:hidden" onClick={onToggle} />}

      <aside className={`app-sidebar ${isOpen ? "open" : ""}`} data-testid="app-sidebar">
        {/* Logo */}
        <div className="p-6 border-b-2 border-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] flex items-center justify-center">
              <BookOpen size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                StudyBuddy
              </h1>
              <p className="text-xs text-[#52525B] font-medium">AI Learning Assistant</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2" data-testid="sidebar-nav">
          {/* Search button */}
          <button
            data-testid="sidebar-search-btn"
            onClick={() => { onSearchOpen?.(); if (window.innerWidth < 768) onToggle(); }}
            className="w-full flex items-center gap-3 px-4 py-3 font-bold text-sm border-2 border-transparent hover:bg-[#FFFDF7] hover:border-[#0A0A0A] transition-all"
          >
            <Search size={20} strokeWidth={2.5} />
            Search
          </button>
          
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => { if (window.innerWidth < 768) onToggle(); }}
                className={`flex items-center gap-3 px-4 py-3 font-bold text-sm border-2 transition-all duration-150 ${
                  isActive
                    ? "bg-[#FFDE59] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] -translate-y-0.5"
                    : "border-transparent hover:bg-[#FFFDF7] hover:border-[#0A0A0A]"
                }`}
              >
                <item.icon size={20} strokeWidth={2.5} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t-2 border-[#0A0A0A]">
          {user && (
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-[#C3B1E1] border-2 border-[#0A0A0A] flex items-center justify-center text-sm font-extrabold">
                  {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{user.name || "User"}</p>
                  <p className="text-[10px] text-[#52525B] truncate">{user.email}</p>
                </div>
              </div>
              <button
                data-testid="logout-btn"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] px-4 py-2 font-bold text-xs neo-btn"
              >
                <LogOut size={14} strokeWidth={2.5} /> Sign Out
              </button>
            </div>
          )}
          
        </div>
      </aside>
    </>
  );
}
