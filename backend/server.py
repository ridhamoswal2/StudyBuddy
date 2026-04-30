from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response, Request, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import json
import re
import secrets
import requests
from datetime import datetime, timezone, timedelta
from PyPDF2 import PdfReader
import io
import math
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials as firebase_credentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# AI / Auth Provider config
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "inclusionai/ling-2.6-1t:free")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
FIREBASE_WEB_API_KEY = os.environ.get("FIREBASE_WEB_API_KEY", "")

# Local file storage in MongoDB (free-tier friendly with Atlas)
APP_NAME = "learning-assistant"
firebase_app = None

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== AUTH HELPERS ====================

def init_firebase():
    global firebase_app
    if firebase_app:
        return firebase_app

    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")

    if not project_id or not client_email or not private_key:
        raise RuntimeError("Firebase Admin env vars are missing")

    cred = firebase_credentials.Certificate({
        "type": "service_account",
        "project_id": project_id,
        "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
        "private_key": private_key,
        "client_email": client_email,
        "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_X509_CERT_URL", ""),
    })
    firebase_app = firebase_admin.initialize_app(cred)
    return firebase_app

async def upsert_user_from_firebase(decoded_token: dict, fallback_name: str = "") -> dict:
    email = (decoded_token.get("email") or "").strip().lower()
    firebase_uid = decoded_token.get("uid") or decoded_token.get("user_id")
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    user = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user and email:
        user = await db.users.find_one({"email": email})

    if user:
        updates = {}
        if not user.get("firebase_uid"):
            updates["firebase_uid"] = firebase_uid
        if fallback_name and not user.get("name"):
            updates["name"] = fallback_name
        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user.update(updates)
    else:
        user_doc = {
            "email": email,
            "firebase_uid": firebase_uid,
            "name": fallback_name or decoded_token.get("name", ""),
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user = user_doc

    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    id_token = auth_header[7:]
    try:
        init_firebase()
        decoded = firebase_auth.verify_id_token(id_token)
        return await upsert_user_from_firebase(decoded)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

async def check_brute_force(email: str):
    attempt = await db.login_attempts.find_one({"identifier": email}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until_str = attempt.get("locked_until")
        if locked_until_str:
            locked_until = datetime.fromisoformat(locked_until_str)
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": email})

async def record_failed_login(email: str):
    attempt = await db.login_attempts.find_one({"identifier": email}, {"_id": 0})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update_fields = {"count": new_count}
        if new_count >= 5:
            update_fields["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": email}, {"$set": update_fields})
    else:
        await db.login_attempts.insert_one({"identifier": email, "count": 1, "locked_until": None})

def firebase_identity_request(path: str, payload: dict) -> dict:
    if not FIREBASE_WEB_API_KEY:
        raise HTTPException(status_code=500, detail="FIREBASE_WEB_API_KEY is not configured")
    url = f"https://identitytoolkit.googleapis.com/v1/{path}?key={FIREBASE_WEB_API_KEY}"
    resp = requests.post(url, json=payload, timeout=30)
    data = resp.json() if resp.content else {}
    if resp.status_code >= 400:
        message = data.get("error", {}).get("message", "Firebase auth request failed")
        raise HTTPException(status_code=400, detail=message)
    return data

async def put_object(path: str, data: bytes, content_type: str) -> dict:
    await db.file_blobs.update_one(
        {"path": path},
        {"$set": {
            "path": path,
            "data": data,
            "content_type": content_type,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    return {"path": path}

async def get_object(path: str):
    doc = await db.file_blobs.find_one({"path": path})
    if not doc:
        raise FileNotFoundError("Object not found")
    return doc.get("data", b""), doc.get("content_type", "application/octet-stream")

# ==================== MODELS ====================

# Auth models
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChatSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    title: str = "New Chat"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SendMessageRequest(BaseModel):
    session_id: str
    message: str

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: int
    explanation: str = ""

class Quiz(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    topic: str
    difficulty: str = "medium"
    questions: List[QuizQuestion] = []
    score: Optional[int] = None
    total: Optional[int] = None
    completed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuizGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    num_questions: int = 5

class QuizSubmitRequest(BaseModel):
    answers: List[int]

class FlashcardItem(BaseModel):
    front: str
    back: str
    ease_factor: float = 2.5
    interval: int = 0
    repetitions: int = 0
    next_review: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FlashcardSet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    topic: str
    cards: List[FlashcardItem] = []
    mastered_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FlashcardGenerateRequest(BaseModel):
    topic: str
    num_cards: int = 8

class FlashcardReviewRequest(BaseModel):
    card_index: int
    quality: int  # 0-5: 0=complete fail, 3=correct with difficulty, 5=perfect

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    original_filename: str
    storage_path: str = ""
    content_type: str = ""
    size: int = 0
    summary: str = ""
    key_points: List[str] = []
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StudyActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    activity_type: str
    description: str
    score: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== AI HELPER ====================

async def get_ai_response(system_message: str, user_message: str, session_id: str = None):
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]

    openrouter_models = [
        OPENROUTER_MODEL,
        "inclusionai/ling-2.6-1t:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "openai/gpt-oss-20b:free",
    ]
    if OPENROUTER_API_KEY:
        for model_id in [m for m in openrouter_models if m]:
            try:
                resp = requests.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_id,
                        "messages": messages,
                        "temperature": 0.4,
                    },
                    timeout=60,
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                if content:
                    return content
            except Exception as exc:
                logger.warning(f"OpenRouter model failed ({model_id}): {exc}")

    gemini_models = [
        GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
    ]
    if GEMINI_API_KEY:
        for model_id in [m for m in gemini_models if m]:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": f"{system_message}\n\n{user_message}"}]}],
                    "generationConfig": {"temperature": 0.4},
                }
                resp = requests.post(gemini_url, json=payload, timeout=60)
                resp.raise_for_status()
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and candidates[0].get("content", {}).get("parts"):
                    return "".join(part.get("text", "") for part in candidates[0]["content"]["parts"]).strip()
            except Exception as exc:
                logger.warning(f"Gemini model failed ({model_id}): {exc}")

    raise RuntimeError("No AI provider available. Configure OPENROUTER_API_KEY or GEMINI_API_KEY.")

# ==================== SM-2 SPACED REPETITION ====================

def sm2_review(card: dict, quality: int) -> dict:
    """SM-2 algorithm for spaced repetition scheduling"""
    ef = card.get("ease_factor", 2.5)
    interval = card.get("interval", 0)
    reps = card.get("repetitions", 0)
    
    if quality < 3:
        reps = 0
        interval = 0
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = math.ceil(interval * ef)
        reps += 1
    
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ef = max(1.3, ef)
    
    next_review = (datetime.now(timezone.utc) + timedelta(days=interval)).isoformat()
    return {"ease_factor": round(ef, 2), "interval": interval, "repetitions": reps, "next_review": next_review}

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(req: UserRegister, request: Request):
    email = req.email.strip().lower()
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    init_firebase()

    # Preferred path: client has already created/signed-in Firebase user and sends ID token.
    token = None
    incoming_auth = request.headers.get("Authorization", "")
    if incoming_auth.startswith("Bearer "):
        token = incoming_auth[7:]

    if token:
        decoded = firebase_auth.verify_id_token(token)
        user = await upsert_user_from_firebase(decoded, fallback_name=req.name.strip())
        return user

    signup = firebase_identity_request("accounts:signUp", {
        "email": email,
        "password": req.password,
        "returnSecureToken": True,
    })
    decoded = firebase_auth.verify_id_token(signup["idToken"])
    user = await upsert_user_from_firebase(decoded, fallback_name=req.name.strip())
    return user

@api_router.post("/auth/login")
async def login(req: UserLogin, request: Request, response: Response):
    email = req.email.strip().lower()
    
    await check_brute_force(email)
    
    try:
        init_firebase()
        sign_in = firebase_identity_request("accounts:signInWithPassword", {
            "email": email,
            "password": req.password,
            "returnSecureToken": True,
        })
        decoded = firebase_auth.verify_id_token(sign_in["idToken"])
        user = await upsert_user_from_firebase(decoded)
    except HTTPException:
        await record_failed_login(email)
        raise
    
    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": email})
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    return {"status": "logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    # Firebase refresh is handled client-side via SDK; endpoint retained for compatibility.
    return {"status": "refresh-not-required"}

@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    # Always return success to prevent email enumeration
    try:
        firebase_identity_request("accounts:sendOobCode", {
            "requestType": "PASSWORD_RESET",
            "email": email,
        })
    except Exception:
        pass
    return {"status": "If the email exists, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    firebase_identity_request("accounts:resetPassword", {
        "oobCode": req.token,
        "newPassword": req.new_password,
    })
    return {"status": "Password reset successfully"}

# ==================== CHAT ENDPOINTS ====================

@api_router.get("/chat/sessions")
async def get_chat_sessions(request: Request):
    user = await get_current_user(request)
    sessions = await db.chat_sessions.find({"user_id": user["_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return sessions

@api_router.post("/chat/sessions")
async def create_chat_session(request: Request):
    user = await get_current_user(request)
    session = ChatSession(user_id=user["_id"])
    await db.chat_sessions.insert_one(session.model_dump())
    return session.model_dump()

@api_router.delete("/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str, request: Request):
    user = await get_current_user(request)
    await db.chat_sessions.delete_one({"id": session_id, "user_id": user["_id"]})
    await db.chat_messages.delete_many({"session_id": session_id})
    return {"status": "deleted"}

@api_router.get("/chat/sessions/{session_id}/messages")
async def get_chat_messages(session_id: str, request: Request):
    await get_current_user(request)
    messages = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return messages

@api_router.post("/chat/send")
async def send_chat_message(req: SendMessageRequest, request: Request):
    user = await get_current_user(request)
    # Save user message
    user_msg = ChatMessage(session_id=req.session_id, role="user", content=req.message)
    await db.chat_messages.insert_one(user_msg.model_dump())

    # Get previous messages for context
    prev_messages = await db.chat_messages.find(
        {"session_id": req.session_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    prev_messages.reverse()

    context = "\n".join([f"{m['role']}: {m['content']}" for m in prev_messages[-10:]])

    system = """You are a helpful, knowledgeable learning assistant. You help students understand concepts, solve problems, and learn effectively. 
Provide clear explanations with examples when helpful. Use markdown formatting for better readability.
If asked about a topic, provide structured, educational responses."""

    try:
        ai_response = await get_ai_response(system, f"Previous conversation:\n{context}\n\nStudent's question: {req.message}")
    except Exception as e:
        logger.error(f"AI error: {e}")
        ai_response = "I'm having trouble connecting right now. Please try again in a moment."

    # Save AI message
    ai_msg = ChatMessage(session_id=req.session_id, role="assistant", content=ai_response)
    await db.chat_messages.insert_one(ai_msg.model_dump())

    # Update session title if first message
    msg_count = await db.chat_messages.count_documents({"session_id": req.session_id})
    if msg_count <= 2:
        title = req.message[:50] + ("..." if len(req.message) > 50 else "")
        await db.chat_sessions.update_one(
            {"id": req.session_id},
            {"$set": {"title": title, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.chat_sessions.update_one(
            {"id": req.session_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Log activity
    activity = StudyActivity(activity_type="chat", description=f"Chat: {req.message[:60]}", user_id=user["_id"])
    await db.study_activities.insert_one(activity.model_dump())

    return {"user_message": user_msg.model_dump(), "ai_message": ai_msg.model_dump()}

# ==================== QUIZ ENDPOINTS ====================

@api_router.post("/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest, request: Request):
    user = await get_current_user(request)
    system = """You are a quiz generator. Generate educational multiple-choice questions.
Return ONLY valid JSON in this exact format:
{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "..."}]}
Each question must have exactly 4 options. correct_answer is the 0-based index of the correct option."""

    prompt = f"Generate {req.num_questions} {req.difficulty} difficulty multiple-choice questions about: {req.topic}"

    try:
        response = await get_ai_response(system, prompt)
        # Parse JSON from response
        json_str = response
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0]
        
        data = json.loads(json_str.strip())
        questions = [QuizQuestion(**q) for q in data["questions"]]
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        questions = [
            QuizQuestion(
                question=f"Sample question about {req.topic}",
                options=["Option A", "Option B", "Option C", "Option D"],
                correct_answer=0,
                explanation="This is a fallback question. AI generation temporarily unavailable."
            )
        ]

    quiz = Quiz(topic=req.topic, difficulty=req.difficulty, questions=questions, total=len(questions), user_id=user["_id"])
    await db.quizzes.insert_one(quiz.model_dump())

    activity = StudyActivity(activity_type="quiz", description=f"Generated quiz: {req.topic}", user_id=user["_id"])
    await db.study_activities.insert_one(activity.model_dump())

    return quiz.model_dump()

@api_router.get("/quiz/list")
async def list_quizzes(request: Request):
    user = await get_current_user(request)
    quizzes = await db.quizzes.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return quizzes

@api_router.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str, request: Request):
    await get_current_user(request)
    quiz = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@api_router.post("/quiz/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, req: QuizSubmitRequest, request: Request):
    user = await get_current_user(request)
    quiz = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    score = 0
    results = []
    for i, answer in enumerate(req.answers):
        if i < len(quiz["questions"]):
            correct = quiz["questions"][i]["correct_answer"]
            is_correct = answer == correct
            if is_correct:
                score += 1
            results.append({
                "question_index": i,
                "selected": answer,
                "correct": correct,
                "is_correct": is_correct,
                "explanation": quiz["questions"][i].get("explanation", "")
            })

    total = len(quiz["questions"])
    await db.quizzes.update_one(
        {"id": quiz_id},
        {"$set": {"score": score, "total": total, "completed": True}}
    )

    activity = StudyActivity(
        activity_type="quiz",
        description=f"Completed quiz: {quiz['topic']} ({score}/{total})",
        score=int((score / total) * 100) if total > 0 else 0,
        user_id=user["_id"]
    )
    await db.study_activities.insert_one(activity.model_dump())

    return {"score": score, "total": total, "percentage": int((score / total) * 100) if total > 0 else 0, "results": results}

# ==================== FLASHCARD ENDPOINTS ====================

@api_router.post("/flashcards/generate")
async def generate_flashcards(req: FlashcardGenerateRequest, request: Request):
    user = await get_current_user(request)
    system = """You are a flashcard generator for studying. Create clear, concise flashcards.
Return ONLY valid JSON in this exact format:
{"cards": [{"front": "Question or term", "back": "Answer or definition"}]}"""

    prompt = f"Generate {req.num_cards} study flashcards about: {req.topic}"

    try:
        response = await get_ai_response(system, prompt)
        json_str = response
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0]
        
        data = json.loads(json_str.strip())
        cards = [FlashcardItem(front=c["front"], back=c["back"]) for c in data["cards"]]
    except Exception as e:
        logger.error(f"Flashcard generation error: {e}")
        cards = [
            FlashcardItem(front=f"What is {req.topic}?", back="A topic worth studying! AI generation temporarily unavailable.")
        ]

    fset = FlashcardSet(topic=req.topic, cards=cards, user_id=user["_id"])
    await db.flashcard_sets.insert_one(fset.model_dump())

    activity = StudyActivity(activity_type="flashcard", description=f"Created flashcards: {req.topic}", user_id=user["_id"])
    await db.study_activities.insert_one(activity.model_dump())

    return fset.model_dump()

@api_router.get("/flashcards/sets")
async def list_flashcard_sets(request: Request):
    user = await get_current_user(request)
    sets = await db.flashcard_sets.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return sets

@api_router.get("/flashcards/sets/{set_id}")
async def get_flashcard_set(set_id: str, request: Request):
    await get_current_user(request)
    fset = await db.flashcard_sets.find_one({"id": set_id}, {"_id": 0})
    if not fset:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    return fset

@api_router.put("/flashcards/sets/{set_id}/mastered")
async def update_mastered(set_id: str, count: int = 0, request: Request = None):
    if request:
        await get_current_user(request)
    await db.flashcard_sets.update_one({"id": set_id}, {"$set": {"mastered_count": count}})
    return {"status": "updated"}

@api_router.post("/flashcards/sets/{set_id}/review")
async def review_flashcard(set_id: str, req: FlashcardReviewRequest, request: Request):
    await get_current_user(request)
    fset = await db.flashcard_sets.find_one({"id": set_id}, {"_id": 0})
    if not fset:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    if req.card_index < 0 or req.card_index >= len(fset["cards"]):
        raise HTTPException(status_code=400, detail="Invalid card index")
    
    quality = max(0, min(5, req.quality))
    card = fset["cards"][req.card_index]
    updated = sm2_review(card, quality)
    
    # Update the card in the set
    update_key = f"cards.{req.card_index}"
    await db.flashcard_sets.update_one(
        {"id": set_id},
        {"$set": {
            f"{update_key}.ease_factor": updated["ease_factor"],
            f"{update_key}.interval": updated["interval"],
            f"{update_key}.repetitions": updated["repetitions"],
            f"{update_key}.next_review": updated["next_review"],
        }}
    )
    
    # Count mastered (interval >= 21 days)
    updated_set = await db.flashcard_sets.find_one({"id": set_id}, {"_id": 0})
    mastered = sum(1 for c in updated_set["cards"] if c.get("interval", 0) >= 21)
    await db.flashcard_sets.update_one({"id": set_id}, {"$set": {"mastered_count": mastered}})
    
    return {"card_index": req.card_index, "updated": updated, "mastered_count": mastered}

@api_router.get("/flashcards/sets/{set_id}/due")
async def get_due_cards(set_id: str, request: Request):
    await get_current_user(request)
    fset = await db.flashcard_sets.find_one({"id": set_id}, {"_id": 0})
    if not fset:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    now = datetime.now(timezone.utc).isoformat()
    due_indices = []
    for i, card in enumerate(fset["cards"]):
        if card.get("next_review", "") <= now:
            due_indices.append(i)
    
    return {"set_id": set_id, "due_indices": due_indices, "total_due": len(due_indices)}

# ==================== DOCUMENT ENDPOINTS ====================

@api_router.post("/documents/upload")
async def upload_document(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Extract text from PDF
    try:
        reader = PdfReader(io.BytesIO(data))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        text = text[:8000]  # Limit text for AI
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise HTTPException(status_code=400, detail="Could not read PDF file")

    # Upload to object storage
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    storage_path = f"{APP_NAME}/uploads/{file_id}.{ext}"

    try:
        result = await put_object(storage_path, data, file.content_type or "application/pdf")
        stored_path = result.get("path", storage_path)
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        stored_path = ""

    # Generate summary with AI
    system = """You are a document summarizer. Provide a concise summary and extract key points.
Return ONLY valid JSON in this format:
{"summary": "A clear 2-3 paragraph summary...", "key_points": ["Point 1", "Point 2", "Point 3"]}"""

    try:
        response = await get_ai_response(system, f"Summarize this document:\n\n{text}")
        json_str = response
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0]
        
        summary_data = json.loads(json_str.strip())
        summary = summary_data.get("summary", "Summary generation failed.")
        key_points = summary_data.get("key_points", [])
    except Exception as e:
        logger.error(f"Summary generation error: {e}")
        summary = f"Document uploaded: {file.filename}. Auto-summary temporarily unavailable."
        key_points = ["Document has been stored successfully"]

    doc = Document(
        original_filename=file.filename,
        storage_path=stored_path,
        content_type=file.content_type or "application/pdf",
        size=len(data),
        summary=summary,
        key_points=key_points,
        user_id=user["_id"]
    )
    await db.documents.insert_one(doc.model_dump())

    activity = StudyActivity(activity_type="document", description=f"Uploaded: {file.filename}", user_id=user["_id"])
    await db.study_activities.insert_one(activity.model_dump())

    return doc.model_dump()

@api_router.get("/documents")
async def list_documents(request: Request):
    user = await get_current_user(request)
    docs = await db.documents.find({"is_deleted": False, "user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return docs

@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, request: Request):
    await get_current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, request: Request):
    await get_current_user(request)
    await db.documents.update_one({"id": doc_id}, {"$set": {"is_deleted": True}})
    return {"status": "deleted"}

@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, request: Request):
    await get_current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        data, content_type = await get_object(doc["storage_path"])
        return Response(content=data, media_type=doc.get("content_type", content_type),
                        headers={"Content-Disposition": f"attachment; filename={doc['original_filename']}"})
    except Exception:
        raise HTTPException(status_code=500, detail="Could not download file")

# ==================== PROGRESS ENDPOINTS ====================

@api_router.get("/progress/stats")
async def get_progress_stats(request: Request):
    user = await get_current_user(request)
    uid = user["_id"]
    total_chats = await db.chat_sessions.count_documents({"user_id": uid})
    total_quizzes = await db.quizzes.count_documents({"user_id": uid})
    completed_quizzes = await db.quizzes.count_documents({"completed": True, "user_id": uid})
    total_flashcards = await db.flashcard_sets.count_documents({"user_id": uid})
    total_documents = await db.documents.count_documents({"is_deleted": False, "user_id": uid})

    quiz_scores = await db.quizzes.find({"completed": True, "user_id": uid}, {"_id": 0, "score": 1, "total": 1}).to_list(100)
    avg_score = 0
    if quiz_scores:
        scores = [int((q["score"] / q["total"]) * 100) for q in quiz_scores if q.get("total", 0) > 0]
        avg_score = int(sum(scores) / len(scores)) if scores else 0

    # Calculate streak
    activities = await db.study_activities.find({"user_id": uid}, {"_id": 0, "created_at": 1}).sort("created_at", -1).to_list(1000)
    streak = 0
    if activities:
        dates = set()
        for a in activities:
            try:
                dt = datetime.fromisoformat(a["created_at"])
                dates.add(dt.date())
            except (ValueError, KeyError):
                pass
        today = datetime.now(timezone.utc).date()
        current = today
        while current in dates:
            streak += 1
            current -= timedelta(days=1)

    # Total study activities
    total_activities = await db.study_activities.count_documents({"user_id": uid})

    return {
        "total_chats": total_chats,
        "total_quizzes": total_quizzes,
        "completed_quizzes": completed_quizzes,
        "total_flashcards": total_flashcards,
        "total_documents": total_documents,
        "avg_quiz_score": avg_score,
        "streak": streak,
        "total_activities": total_activities
    }

@api_router.get("/progress/activity")
async def get_activity_history(request: Request):
    user = await get_current_user(request)
    activities = await db.study_activities.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return activities

@api_router.get("/progress/weekly")
async def get_weekly_activity(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    activities = await db.study_activities.find(
        {"created_at": {"$gte": week_ago.isoformat()}, "user_id": user["_id"]}, {"_id": 0}
    ).to_list(1000)
    
    # Group by day
    daily = {}
    for i in range(7):
        day = (now - timedelta(days=6-i)).strftime("%a")
        daily[day] = 0
    
    for a in activities:
        try:
            dt = datetime.fromisoformat(a["created_at"])
            day = dt.strftime("%a")
            if day in daily:
                daily[day] += 1
        except (ValueError, KeyError):
            pass
    
    return [{"day": k, "count": v} for k, v in daily.items()]

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# ==================== SEARCH ENDPOINT ====================

@api_router.get("/search")
async def search(request: Request, q: str = Query("", min_length=1), type: str = Query("all")):
    user = await get_current_user(request)
    uid = user["_id"]
    query = q.strip()
    results = {"chats": [], "quizzes": [], "flashcards": [], "documents": []}
    
    regex_filter = {"$regex": query, "$options": "i"}
    
    if type in ("all", "chat"):
        sessions = await db.chat_sessions.find(
            {"user_id": uid, "title": regex_filter}, {"_id": 0}
        ).sort("updated_at", -1).to_list(20)
        results["chats"] = sessions
    
    if type in ("all", "quiz"):
        quizzes = await db.quizzes.find(
            {"user_id": uid, "topic": regex_filter}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        results["quizzes"] = quizzes
    
    if type in ("all", "flashcard"):
        fsets = await db.flashcard_sets.find(
            {"user_id": uid, "topic": regex_filter}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        results["flashcards"] = fsets
    
    if type in ("all", "document"):
        docs = await db.documents.find(
            {"user_id": uid, "is_deleted": False, "$or": [
                {"original_filename": regex_filter},
                {"summary": regex_filter}
            ]}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        results["documents"] = docs
    
    return results

# Include the router
app.include_router(api_router)

# CORS - use specific origin for credential cookies
frontend_url = os.environ.get("FRONTEND_URL", "")
cors_origins = [frontend_url] if frontend_url else os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@studybuddy.com")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "firebase_uid": "",
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    
    # On serverless hosts (like Vercel), project filesystem can be read-only.
    # Keep startup resilient by skipping this optional note file if write fails.
    try:
        credentials_path = ROOT_DIR.parent / "memory" / "test_credentials.md"
        credentials_path.parent.mkdir(parents=True, exist_ok=True)
        with open(credentials_path, "w", encoding="utf-8") as f:
            f.write("# Auth Setup Notes\n\n")
            f.write(f"## Admin Record\n- Email: {admin_email}\n- Role: admin\n")
            f.write("- Sign in this email through Firebase Auth and it will map to admin role.\n\n")
            f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")
    except OSError as exc:
        logger.warning(f"Skipping test credentials file write: {exc}")

@app.on_event("startup")
async def startup():
    try:
        init_firebase()
        logger.info("Firebase Admin initialized")
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("firebase_uid", unique=True, sparse=True)
    await db.login_attempts.create_index("identifier")
    await db.file_blobs.create_index("path", unique=True)
    
    # Seed admin
    await seed_admin()
    logger.info("Database indexes created and admin seeded")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
