# StudyBuddy - AI-Powered Learning Assistant

> A comprehensive full-stack learning platform powered by AI that helps students study effectively through interactive chat, quizzes, flashcards with spaced repetition, and document summarization.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [How AI Works](#how-ai-works)
5. [AI Model Details by Feature](#ai-model-details-by-feature)
6. [Spaced Repetition Algorithm](#spaced-repetition-algorithm)
7. [Authentication](#authentication)
8. [API Endpoints](#api-endpoints)
9. [Project Structure](#project-structure)
10. [Environment Variables](#environment-variables)
11. [AI Usage Limits](#ai-usage-limits)
12. [Getting Started](#getting-started)

---

## Overview

StudyBuddy is an AI-powered learning assistant that combines multiple study tools into one cohesive platform. It uses OpenAI's GPT-4.1 model (via the Emergent LLM Key) to provide intelligent tutoring, generate quizzes and flashcards, and summarize uploaded PDF documents.

The app features JWT-based authentication so each user has their own private learning space, and all study activity is tracked for progress visualization.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Tailwind CSS 3** | Utility-first CSS styling |
| **Shadcn/UI** | Pre-built accessible components |
| **Recharts** | Data visualization (weekly activity chart) |
| **React Router 7** | Client-side routing |
| **Axios** | HTTP client for API calls |
| **React Markdown** | Rendering AI markdown responses |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | Python web framework (async) |
| **MongoDB** | NoSQL database (via Motor async driver) |
| **PyJWT** | JWT token generation/verification |
| **bcrypt** | Password hashing |
| **PyPDF2** | PDF text extraction |
| **emergentintegrations** | AI model integration library |

### Infrastructure
| Technology | Purpose |
|---|---|
| **MongoDB** | Database storage |
| **Emergent Object Storage** | PDF file storage |
| **Emergent LLM Key** | Universal API key for AI models |

### Design System
- **Theme**: Neo-Brutalist with Pastel accents
- **Fonts**: Outfit (headings, 800-900 weight), DM Sans (body, 400-700 weight)
- **Colors**: Butter Yellow (#FFDE59), Pale Mint (#B2F5EA), Soft Lavender (#C3B1E1), Coral (#FF6B6B)
- **Styling**: Thick black borders (2px), hard drop shadows, no border-radius

---

## Features

### 1. AI Chat Q&A
- Real-time conversational AI tutoring
- Session management (create, switch, delete chats)
- Full chat history with markdown rendering
- Context-aware responses (remembers previous messages in session)

### 2. Quiz Generator
- AI-generated multiple-choice quizzes on any topic
- Configurable difficulty (easy, medium, hard)
- Configurable question count (3, 5, 8, 10)
- Instant scoring with detailed answer explanations
- Quiz history with score tracking

### 3. Flashcards with Spaced Repetition (SM-2)
- AI-generated flashcard sets on any topic
- Flip-to-reveal card interface
- **SM-2 spaced repetition algorithm** for optimal review scheduling
- Due card tracking and study-by-due mode
- Mastery tracking (cards with 21+ day intervals)

### 4. Document Upload & Summarization
- PDF upload with AI-powered summarization
- Key points extraction
- Document management (view, expand, delete)
- Secure file storage via Emergent Object Storage

### 5. Learning Dashboard
- Study streak counter
- Quiz completion and average score stats
- Weekly activity bar chart
- Recent activity feed
- Quick action shortcuts

### 6. Search
- Global search across all content types
- Real-time search with debouncing
- Results grouped by type (chats, quizzes, flashcards, documents)

### 7. Authentication
- JWT-based login/registration
- HttpOnly cookie tokens (access + refresh)
- Brute force protection (5 attempts = 15 min lockout)
- Password reset flow
- Per-user data isolation

---

## How AI Works

StudyBuddy uses the **Emergent LLM Key** (`EMERGENT_LLM_KEY`), which is a universal API key provided by the Emergent platform. This key provides access to multiple AI providers (OpenAI, Anthropic, Google) through a single integration library called `emergentintegrations`.

### How it connects:

```
User Action -> Frontend -> FastAPI Backend -> emergentintegrations library -> OpenAI GPT-4.1
```

1. The user performs an action (sends a chat message, generates a quiz, etc.)
2. The frontend sends a request to the FastAPI backend
3. The backend uses the `emergentintegrations` library with `LlmChat` class
4. The library routes the request to OpenAI's GPT-4.1 model using the Emergent LLM Key
5. The AI response is parsed and returned to the user

### Core AI Function:

```python
from emergentintegrations.llm.chat import LlmChat, UserMessage

async def get_ai_response(system_message, user_message, session_id=None):
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=session_id or str(uuid.uuid4()),
        system_message=system_message
    )
    chat.with_model("openai", "gpt-4.1")
    response = await chat.send_message(UserMessage(text=user_message))
    return response
```

---

## AI Model Details by Feature

### Chat Q&A
- **Model**: OpenAI GPT-4.1
- **System Prompt**: Acts as a knowledgeable learning assistant
- **Context**: Last 10 messages from the session are included for continuity
- **Output Format**: Free-form markdown text
- **Use Case**: Explaining concepts, solving problems, answering questions

### Quiz Generation
- **Model**: OpenAI GPT-4.1
- **System Prompt**: Instructed to generate multiple-choice questions
- **Output Format**: Strict JSON with questions, 4 options each, correct answer index, and explanations
- **Parsing**: Extracts JSON from markdown code blocks if present
- **Fallback**: Returns a sample question if AI generation fails

### Flashcard Generation
- **Model**: OpenAI GPT-4.1
- **System Prompt**: Instructed to create study flashcards
- **Output Format**: Strict JSON with front (question/term) and back (answer/definition)
- **Post-processing**: Each card is initialized with SM-2 spaced repetition defaults

### Document Summarization
- **Model**: OpenAI GPT-4.1
- **Input**: Extracted text from PDF (limited to first 8,000 characters)
- **System Prompt**: Instructed to provide a 2-3 paragraph summary and extract key points
- **Output Format**: Strict JSON with summary string and key_points array
- **Pipeline**: PDF upload -> PyPDF2 text extraction -> AI summarization -> Store result

---

## Spaced Repetition Algorithm

The flashcard system uses the **SM-2 (SuperMemo 2) algorithm**, a scientifically-proven spaced repetition method:

### How It Works:
1. When you review a card, you rate your recall quality (0-5 scale)
2. The algorithm adjusts three parameters:
   - **Interval**: Days until next review
   - **Ease Factor (EF)**: Difficulty multiplier (min 1.3)
   - **Repetitions**: Consecutive correct recalls

### Rating Scale:
| Button | Quality | Effect |
|---|---|---|
| **Again** | 0 | Reset to beginning (interval = 0) |
| **Hard** | 3 | Correct but difficult, slower interval growth |
| **Good** | 4 | Normal progression |
| **Easy** | 5 | Fast progression, higher ease factor |

### Interval Progression:
- First correct: 1 day
- Second correct: 6 days
- Subsequent: Previous interval x Ease Factor
- A card is considered "mastered" when its interval reaches 21+ days

---

## Authentication

### Flow:
1. **Register**: POST `/api/auth/register` - Creates account, sets HttpOnly cookies
2. **Login**: POST `/api/auth/login` - Validates credentials, sets cookies
3. **Session Check**: GET `/api/auth/me` - Returns current user from cookie
4. **Token Refresh**: POST `/api/auth/refresh` - Issues new access token from refresh token
5. **Logout**: POST `/api/auth/logout` - Clears cookies

### Security Features:
- Passwords hashed with bcrypt (salt rounds)
- Access tokens expire in 60 minutes
- Refresh tokens expire in 7 days
- HttpOnly cookies (not accessible via JavaScript)
- Brute force protection: 5 failed attempts = 15 minute lockout
- Email normalization to prevent duplicate accounts

### Default Admin:
- Email: `admin@studybuddy.com`
- Password: `Admin@123`

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/chat/sessions` | List user's chat sessions |
| POST | `/api/chat/sessions` | Create new chat session |
| DELETE | `/api/chat/sessions/{id}` | Delete a chat session |
| GET | `/api/chat/sessions/{id}/messages` | Get messages for a session |
| POST | `/api/chat/send` | Send message & get AI response |

### Quizzes
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/quiz/generate` | Generate AI quiz on a topic |
| GET | `/api/quiz/list` | List user's quizzes |
| GET | `/api/quiz/{id}` | Get specific quiz |
| POST | `/api/quiz/{id}/submit` | Submit quiz answers |

### Flashcards
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/flashcards/generate` | Generate flashcard set |
| GET | `/api/flashcards/sets` | List user's flashcard sets |
| GET | `/api/flashcards/sets/{id}` | Get specific set |
| POST | `/api/flashcards/sets/{id}/review` | Review a card (SM-2) |
| GET | `/api/flashcards/sets/{id}/due` | Get due cards for review |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload & summarize PDF |
| GET | `/api/documents` | List user's documents |
| GET | `/api/documents/{id}` | Get document details |
| DELETE | `/api/documents/{id}` | Soft-delete document |

### Progress & Search
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/progress/stats` | Dashboard statistics |
| GET | `/api/progress/activity` | Recent activity log |
| GET | `/api/progress/weekly` | Weekly activity data |
| GET | `/api/search?q=term&type=all` | Search across all content |

---

## Project Structure

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application (all routes + models)
│   ├── .env               # Environment variables
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── public/
│   │   └── index.html     # HTML template with Google Fonts
│   ├── src/
│   │   ├── App.js         # Root component with routing + auth
│   │   ├── App.css        # Global styles + animations
│   │   ├── index.css      # Tailwind + CSS variables
│   │   ├── contexts/
│   │   │   └── AuthContext.js    # Authentication state management
│   │   ├── components/
│   │   │   ├── Sidebar.js        # Navigation sidebar
│   │   │   ├── SearchPanel.js    # Global search overlay
│   │   │   └── ui/              # Shadcn UI components
│   │   └── pages/
│   │       ├── Dashboard.js      # Stats + activity overview
│   │       ├── ChatPage.js       # AI chat interface
│   │       ├── QuizPage.js       # Quiz generation + taking
│   │       ├── FlashcardsPage.js # Flashcards + spaced repetition
│   │       ├── DocumentsPage.js  # PDF upload + summaries
│   │       ├── LoginPage.js      # Login form
│   │       └── RegisterPage.js   # Registration form
│   ├── .env               # Frontend environment variables
│   └── package.json       # Node.js dependencies
└── README.md              # This file
```

---

## Environment Variables

### Backend (`/app/backend/.env`)
| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `EMERGENT_LLM_KEY` | Universal AI API key (for OpenAI, Anthropic, Google) |
| `JWT_SECRET` | Secret key for JWT token signing |
| `ADMIN_EMAIL` | Default admin account email |
| `ADMIN_PASSWORD` | Default admin account password |
| `FRONTEND_URL` | Frontend URL for CORS configuration |

### Frontend (`/app/frontend/.env`)
| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend API base URL |

---

## AI Usage Limits

### Emergent LLM Key
The app uses the **Emergent LLM Key** which is a pre-paid credit-based API key. Here's what you need to know:

- **Credits**: Each AI call consumes credits from your Emergent key balance
- **Rate Limits**: Standard API rate limits apply (varies by model)
- **Token Limits**: GPT-4.1 supports up to 128K context window
- **Cost per call**: Varies based on input/output tokens:
  - Chat message: ~500-2000 tokens per exchange
  - Quiz generation (5 questions): ~1500-3000 tokens
  - Flashcard generation (8 cards): ~1000-2000 tokens
  - Document summarization: ~2000-4000 tokens (depends on PDF size)

### Adding More Balance
If your key balance runs low:
1. Go to **Profile -> Universal Key -> Add Balance**
2. Or enable **Auto Top-Up** to automatically replenish

### Switching to Your Own Key
You can replace the Emergent key with your own OpenAI API key at any time. Just update the `EMERGENT_LLM_KEY` in the backend `.env` file and adjust the model configuration in `server.py`.

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally

### Backend Setup
```bash
cd /app/backend
pip install -r requirements.txt
# Configure .env with your settings
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
cd /app/frontend
yarn install
yarn start
```

### Default Login
- **Email**: admin@studybuddy.com
- **Password**: Admin@123

---

## License

This project was built with [Emergent](https://emergent.sh).

---

## Free Deployment

For Firebase Auth + MongoDB Atlas + OpenRouter/Gemini free-tier deployment, use:

- `DEPLOY_FREE.md`
- `DEPLOY_VERCEL.md` (Vercel-specific frontend + backend setup)
