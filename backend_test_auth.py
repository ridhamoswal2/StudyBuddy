import requests
import sys
import json
import time
from datetime import datetime

class AuthenticatedAPITester:
    def __init__(self, base_url="https://ai-study-buddy-129.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()  # Use session for cookie management
        self.user_id = None
        self.session_id = None
        self.quiz_id = None
        self.flashcard_set_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, timeout=30):
        """Run a single API test with session cookies"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                if files:
                    response = self.session.post(url, files=files, timeout=timeout)
                else:
                    response = self.session.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers, timeout=timeout)

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
        """Test health endpoint (no auth required)"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_register_new_user(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "Register New User",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success:
            self.user_id = response.get('_id')
            print(f"   ✓ Registered user: {response.get('email')}")
            print(f"   ✓ User ID: {self.user_id}")
            # Check if cookies were set
            cookies = self.session.cookies
            if 'access_token' in cookies and 'refresh_token' in cookies:
                print(f"   ✓ Auth cookies set successfully")
            else:
                print(f"   ⚠️ Auth cookies not found")
        
        return success

    def test_login_admin(self):
        """Test admin login"""
        admin_creds = {
            "email": "admin@studybuddy.com",
            "password": "Admin@123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_creds
        )
        
        if success:
            self.user_id = response.get('_id')
            print(f"   ✓ Logged in as: {response.get('email')}")
            print(f"   ✓ Role: {response.get('role')}")
            # Check if cookies were set
            cookies = self.session.cookies
            if 'access_token' in cookies and 'refresh_token' in cookies:
                print(f"   ✓ Auth cookies set successfully")
            else:
                print(f"   ⚠️ Auth cookies not found")
        
        return success

    def test_get_current_user(self):
        """Test GET /auth/me endpoint"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success:
            print(f"   ✓ User data: {response.get('email')} ({response.get('role')})")
        
        return success

    def test_protected_endpoints_without_auth(self):
        """Test that protected endpoints return 401 without auth"""
        # Clear session cookies
        self.session.cookies.clear()
        
        endpoints_to_test = [
            ("progress/stats", "GET"),
            ("chat/sessions", "GET"),
            ("quiz/list", "GET"),
            ("flashcards/sets", "GET"),
            ("documents", "GET"),
            ("search", "GET")
        ]
        
        all_protected = True
        for endpoint, method in endpoints_to_test:
            success, _ = self.run_test(
                f"Protected {endpoint} (no auth)",
                method,
                endpoint,
                401
            )
            if not success:
                all_protected = False
        
        return all_protected

    def test_refresh_token(self):
        """Test token refresh endpoint"""
        # First login to get tokens
        admin_creds = {
            "email": "admin@studybuddy.com", 
            "password": "Admin@123"
        }
        
        login_success, _ = self.run_test(
            "Login for Refresh Test",
            "POST",
            "auth/login",
            200,
            data=admin_creds
        )
        
        if not login_success:
            return False
        
        # Test refresh
        success, response = self.run_test(
            "Refresh Token",
            "POST",
            "auth/refresh",
            200
        )
        
        return success

    def test_logout(self):
        """Test logout endpoint"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        
        if success:
            # Check if cookies were cleared
            cookies = self.session.cookies
            if 'access_token' not in cookies and 'refresh_token' not in cookies:
                print(f"   ✓ Auth cookies cleared successfully")
            else:
                print(f"   ⚠️ Auth cookies still present after logout")
        
        return success

    def test_user_scoped_data(self):
        """Test that data is properly scoped to users"""
        # Login as admin first
        admin_creds = {
            "email": "admin@studybuddy.com",
            "password": "Admin@123"
        }
        
        login_success, _ = self.run_test(
            "Login as Admin for Scoping Test",
            "POST", 
            "auth/login",
            200,
            data=admin_creds
        )
        
        if not login_success:
            return False
        
        # Create some data as admin
        success, response = self.run_test(
            "Create Chat Session (Admin)",
            "POST",
            "chat/sessions",
            200
        )
        
        if not success:
            return False
        
        admin_session_id = response.get('id')
        
        # Logout and register new user
        self.test_logout()
        
        timestamp = int(time.time())
        test_user = {
            "name": f"Scope Test User {timestamp}",
            "email": f"scopetest{timestamp}@example.com", 
            "password": "TestPass123!"
        }
        
        reg_success, _ = self.run_test(
            "Register User for Scoping Test",
            "POST",
            "auth/register", 
            200,
            data=test_user
        )
        
        if not reg_success:
            return False
        
        # Check that new user doesn't see admin's data
        success, response = self.run_test(
            "List Chat Sessions (New User)",
            "GET",
            "chat/sessions",
            200
        )
        
        if success:
            sessions = response if isinstance(response, list) else []
            admin_session_visible = any(s.get('id') == admin_session_id for s in sessions)
            if not admin_session_visible:
                print(f"   ✓ User scoping working - new user can't see admin's sessions")
                return True
            else:
                print(f"   ❌ User scoping failed - new user can see admin's sessions")
                return False
        
        return False

    def test_search_functionality(self):
        """Test global search endpoint"""
        # Login first
        admin_creds = {
            "email": "admin@studybuddy.com",
            "password": "Admin@123"
        }
        
        login_success, _ = self.run_test(
            "Login for Search Test",
            "POST",
            "auth/login",
            200,
            data=admin_creds
        )
        
        if not login_success:
            return False
        
        # Test search with query
        success, response = self.run_test(
            "Search with Query",
            "GET",
            "search?q=test&type=all",
            200
        )
        
        if success:
            # Check response structure
            expected_keys = ['chats', 'quizzes', 'flashcards', 'documents']
            has_all_keys = all(key in response for key in expected_keys)
            if has_all_keys:
                print(f"   ✓ Search response has all expected categories")
            else:
                print(f"   ⚠️ Search response missing some categories")
        
        return success

    def test_spaced_repetition_features(self):
        """Test SM-2 spaced repetition features"""
        # Login first
        admin_creds = {
            "email": "admin@studybuddy.com",
            "password": "Admin@123"
        }
        
        login_success, _ = self.run_test(
            "Login for Spaced Repetition Test",
            "POST",
            "auth/login",
            200,
            data=admin_creds
        )
        
        if not login_success:
            return False
        
        # Generate flashcards
        success, response = self.run_test(
            "Generate Flashcards for SM-2",
            "POST",
            "flashcards/generate",
            200,
            data={"topic": "SM-2 Test", "num_cards": 3},
            timeout=60
        )
        
        if not success:
            return False
        
        set_id = response.get('id')
        if not set_id:
            return False
        
        # Test due cards endpoint
        success, response = self.run_test(
            "Get Due Cards",
            "GET",
            f"flashcards/sets/{set_id}/due",
            200
        )
        
        if not success:
            return False
        
        due_indices = response.get('due_indices', [])
        print(f"   ✓ Found {len(due_indices)} due cards")
        
        # Test card review with different quality ratings
        if due_indices:
            card_index = due_indices[0]
            
            # Test review with quality 3 (Hard)
            success, response = self.run_test(
                "Review Card (Hard)",
                "POST",
                f"flashcards/sets/{set_id}/review",
                200,
                data={"card_index": card_index, "quality": 3}
            )
            
            if success:
                updated = response.get('updated', {})
                print(f"   ✓ Card reviewed - EF: {updated.get('ease_factor')}, Interval: {updated.get('interval')}d")
        
        return success

    def test_brute_force_protection(self):
        """Test brute force protection"""
        # Clear session first
        self.session.cookies.clear()
        
        # Try multiple failed logins
        failed_attempts = 0
        for i in range(6):  # Try 6 times to trigger lockout
            success, response = self.run_test(
                f"Failed Login Attempt {i+1}",
                "POST",
                "auth/login",
                401,  # Expect 401 for wrong credentials
                data={"email": "admin@studybuddy.com", "password": "wrongpassword"}
            )
            if success:  # 401 is expected for wrong password
                failed_attempts += 1
            time.sleep(0.5)  # Small delay between attempts
        
        # 6th attempt should return 429 (rate limited)
        success, response = self.run_test(
            "Brute Force Lockout Test",
            "POST", 
            "auth/login",
            429,  # Expect 429 for rate limiting
            data={"email": "admin@studybuddy.com", "password": "wrongpassword"}
        )
        
        if success:
            print(f"   ✓ Brute force protection working - account locked after failed attempts")
        
        return success

def main():
    print("🚀 Starting AI Learning Assistant Authentication Tests")
    print("=" * 60)
    
    tester = AuthenticatedAPITester()
    
    # Run all tests in order
    tests = [
        ("Health Check", tester.test_health_check),
        ("Protected Endpoints (No Auth)", tester.test_protected_endpoints_without_auth),
        ("Register New User", tester.test_register_new_user),
        ("Get Current User", tester.test_get_current_user),
        ("Logout", tester.test_logout),
        ("Admin Login", tester.test_login_admin),
        ("Get Current User (Admin)", tester.test_get_current_user),
        ("Refresh Token", tester.test_refresh_token),
        ("User Scoped Data", tester.test_user_scoped_data),
        ("Search Functionality", tester.test_search_functionality),
        ("Spaced Repetition Features", tester.test_spaced_repetition_features),
        ("Brute Force Protection", tester.test_brute_force_protection),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
        
        # Small delay between tests
        time.sleep(1)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All authentication tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())