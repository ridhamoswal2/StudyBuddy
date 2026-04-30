# StudyBuddy - AI Learning Assistant PRD

## Original Problem Statement
Build a Full-Stack AI-Powered Learning Assistant App with Chat Q&A, Quiz/Flashcard generation, Document upload & summarization, Learning progress tracking, Authentication, Spaced Repetition, and Search.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (Neo-Brutalist theme: Outfit + DM Sans fonts)
- **Backend**: FastAPI + MongoDB + emergentintegrations (OpenAI GPT-4.1 via Emergent LLM Key)
- **Storage**: Emergent Object Storage for PDF uploads
- **Auth**: JWT-based with HttpOnly cookies, bcrypt password hashing, brute force protection

## User Personas
- Students seeking AI-powered study help
- Learners wanting quiz/flashcard generation on any topic
- Users who want PDF document summarization

## Core Requirements
- JWT Authentication (login, register, session management)
- AI Chat Q&A with session management
- Quiz generation from any topic (easy/medium/hard, configurable question count)
- Flashcard generation with SM-2 spaced repetition
- PDF document upload with AI summarization and key point extraction
- Learning dashboard with stats, streaks, weekly activity chart
- Global search across all content
- Per-user data isolation

## What's Been Implemented (April 11, 2026)
### Phase 1 - MVP
- [x] Full backend with 21+ API endpoints
- [x] AI Chat, Quiz, Flashcard, Document features
- [x] Dashboard with stats, weekly chart, activity feed
- [x] Neo-Brutalist UI design

### Phase 2 - Production Ready
- [x] JWT authentication with HttpOnly cookies
- [x] User registration and login with brute force protection
- [x] SM-2 spaced repetition for flashcards (Again/Hard/Good/Easy)
- [x] Global search across chats, quizzes, flashcards, documents
- [x] Per-user data isolation on all endpoints
- [x] Admin seeding on startup
- [x] Comprehensive README with AI documentation
- [x] Password reset flow

## Test Results
- Backend: 97-100% (all endpoints tested)
- Frontend: 100% (all UI flows verified)

## Prioritized Backlog
### P1 (Important)
- Email notifications for password reset
- Study timer / Pomodoro integration
- Export quiz results as PDF

### P2 (Nice to Have)
- Dark mode toggle
- Share quizzes with others via link
- Subject categorization and tags
- OAuth social login (Google)

## Next Tasks
1. Email integration for password reset
2. Study timer feature
3. Export/share functionality
