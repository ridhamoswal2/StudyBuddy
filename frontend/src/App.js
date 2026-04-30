import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import SearchPanel from "@/components/SearchPanel";
import Dashboard from "@/pages/Dashboard";
import ChatPage from "@/pages/ChatPage";
import QuizPage from "@/pages/QuizPage";
import FlashcardsPage from "@/pages/FlashcardsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
        <div className="w-12 h-12 bg-[#FFDE59] border-2 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] animate-pulse" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onSearchOpen={() => setSearchOpen(true)} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/quizzes" element={<QuizPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
        </Routes>
      </main>
      <SearchPanel isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
