import requests
import sys
import json
import time
from datetime import datetime

class LearningAssistantAPITester:
    def __init__(self, base_url="https://ai-study-buddy-129.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.quiz_id = None
        self.flashcard_set_id = None
        self.document_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=timeout)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json() if response.content else {}
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_progress_stats(self):
        """Test progress stats endpoint"""
        success, response = self.run_test(
            "Progress Stats",
            "GET",
            "progress/stats",
            200
        )
        if success:
            required_fields = ['total_chats', 'total_quizzes', 'completed_quizzes', 
                             'total_flashcards', 'total_documents', 'avg_quiz_score', 
                             'streak', 'total_activities']
            for field in required_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in stats response")
        return success

    def test_weekly_activity(self):
        """Test weekly activity endpoint"""
        success, response = self.run_test(
            "Weekly Activity",
            "GET",
            "progress/weekly",
            200
        )
        if success and isinstance(response, list):
            if len(response) == 7:
                print(f"   ✓ Returned 7 days of data")
            else:
                print(f"   Warning: Expected 7 days, got {len(response)}")
        return success

    def test_chat_sessions_crud(self):
        """Test chat sessions CRUD operations"""
        # Create session
        success, response = self.run_test(
            "Create Chat Session",
            "POST",
            "chat/sessions",
            200
        )
        if not success:
            return False
        
        self.session_id = response.get('id')
        if not self.session_id:
            print("   ❌ No session ID returned")
            return False

        # List sessions
        success, _ = self.run_test(
            "List Chat Sessions",
            "GET",
            "chat/sessions",
            200
        )
        if not success:
            return False

        # Send message
        success, response = self.run_test(
            "Send Chat Message",
            "POST",
            "chat/send",
            200,
            data={"session_id": self.session_id, "message": "What is photosynthesis?"},
            timeout=60
        )
        if not success:
            return False

        # Get messages
        success, _ = self.run_test(
            "Get Chat Messages",
            "GET",
            f"chat/sessions/{self.session_id}/messages",
            200
        )
        if not success:
            return False

        # Delete session
        success, _ = self.run_test(
            "Delete Chat Session",
            "DELETE",
            f"chat/sessions/{self.session_id}",
            200
        )
        return success

    def test_quiz_generation(self):
        """Test quiz generation and submission"""
        # Generate quiz
        success, response = self.run_test(
            "Generate Quiz",
            "POST",
            "quiz/generate",
            200,
            data={"topic": "Python Programming", "difficulty": "medium", "num_questions": 3},
            timeout=60
        )
        if not success:
            return False

        self.quiz_id = response.get('id')
        if not self.quiz_id:
            print("   ❌ No quiz ID returned")
            return False

        # Check quiz has questions
        questions = response.get('questions', [])
        if len(questions) == 0:
            print("   ❌ No questions generated")
            return False

        print(f"   ✓ Generated {len(questions)} questions")

        # List quizzes
        success, _ = self.run_test(
            "List Quizzes",
            "GET",
            "quiz/list",
            200
        )
        if not success:
            return False

        # Get specific quiz
        success, _ = self.run_test(
            "Get Quiz",
            "GET",
            f"quiz/{self.quiz_id}",
            200
        )
        if not success:
            return False

        # Submit quiz
        answers = [0] * len(questions)  # Answer all with first option
        success, response = self.run_test(
            "Submit Quiz",
            "POST",
            f"quiz/{self.quiz_id}/submit",
            200,
            data={"answers": answers}
        )
        if success:
            score = response.get('score', 0)
            total = response.get('total', 0)
            print(f"   ✓ Quiz submitted - Score: {score}/{total}")

        return success

    def test_flashcard_generation(self):
        """Test flashcard generation"""
        success, response = self.run_test(
            "Generate Flashcards",
            "POST",
            "flashcards/generate",
            200,
            data={"topic": "Spanish Vocabulary", "num_cards": 5},
            timeout=60
        )
        if not success:
            return False

        self.flashcard_set_id = response.get('id')
        if not self.flashcard_set_id:
            print("   ❌ No flashcard set ID returned")
            return False

        cards = response.get('cards', [])
        if len(cards) == 0:
            print("   ❌ No flashcards generated")
            return False

        print(f"   ✓ Generated {len(cards)} flashcards")

        # List flashcard sets
        success, _ = self.run_test(
            "List Flashcard Sets",
            "GET",
            "flashcards/sets",
            200
        )
        if not success:
            return False

        # Get specific set
        success, _ = self.run_test(
            "Get Flashcard Set",
            "GET",
            f"flashcards/sets/{self.flashcard_set_id}",
            200
        )
        if not success:
            return False

        # Update mastered count
        success, _ = self.run_test(
            "Update Mastered Count",
            "PUT",
            f"flashcards/sets/{self.flashcard_set_id}/mastered?count=2",
            200
        )
        return success

    def test_document_upload(self):
        """Test document upload (mock PDF)"""
        # Create a simple mock PDF content
        mock_pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n178\n%%EOF"
        
        files = {'file': ('test_document.pdf', mock_pdf_content, 'application/pdf')}
        
        success, response = self.run_test(
            "Upload Document",
            "POST",
            "documents/upload",
            200,
            files=files,
            timeout=120
        )
        if not success:
            return False

        self.document_id = response.get('id')
        if not self.document_id:
            print("   ❌ No document ID returned")
            return False

        summary = response.get('summary', '')
        if not summary:
            print("   ⚠️ No summary generated")
        else:
            print(f"   ✓ Summary generated: {summary[:50]}...")

        # List documents
        success, _ = self.run_test(
            "List Documents",
            "GET",
            "documents",
            200
        )
        if not success:
            return False

        # Get specific document
        success, _ = self.run_test(
            "Get Document",
            "GET",
            f"documents/{self.document_id}",
            200
        )
        if not success:
            return False

        # Delete document
        success, _ = self.run_test(
            "Delete Document",
            "DELETE",
            f"documents/{self.document_id}",
            200
        )
        return success

    def test_activity_history(self):
        """Test activity history endpoint"""
        success, response = self.run_test(
            "Activity History",
            "GET",
            "progress/activity",
            200
        )
        if success and isinstance(response, list):
            print(f"   ✓ Returned {len(response)} activities")
        return success

def main():
    print("🚀 Starting AI Learning Assistant API Tests")
    print("=" * 50)
    
    tester = LearningAssistantAPITester()
    
    # Run all tests
    tests = [
        tester.test_health_check,
        tester.test_progress_stats,
        tester.test_weekly_activity,
        tester.test_chat_sessions_crud,
        tester.test_quiz_generation,
        tester.test_flashcard_generation,
        tester.test_document_upload,
        tester.test_activity_history,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
        
        # Small delay between tests
        time.sleep(1)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())