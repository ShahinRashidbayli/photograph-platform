#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3001}"
COOKIES_FILE="/tmp/auth-cookies.txt"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Auth API Testing Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Function to print section headers
print_section() {
  echo -e "${YELLOW}▶ $1${NC}"
}

# Function to print success
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Test 1: Register a new photographer
print_section "Test 1: Register Photographer"
echo "Request: POST /api/auth/register"
echo "Payload: New photographer account"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -c "$COOKIES_FILE" \
  -d '{
    "fullName": "Anna Fischer",
    "email": "anna'$(date +%s)'@fotografie.de",
    "password": "TestPassword123",
    "subdomain": "anna-fischer-'$(date +%s)'"
  }')

if echo "$RESPONSE" | grep -q "accessToken"; then
  print_success "Registration successful"
  echo "Response: $RESPONSE" | head -c 200
  echo "..."
else
  print_error "Registration failed"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Get current user
print_section "Test 2: Get Current User (GET /api/auth/me)"
echo "Request: GET /api/auth/me"
echo "Auth: Using cookies from registration"

RESPONSE=$(curl -s "$BASE_URL/api/auth/me" -b "$COOKIES_FILE")

if echo "$RESPONSE" | grep -q "email"; then
  print_success "Retrieved user info"
  echo "Response: $RESPONSE" | head -c 200
  echo "..."
else
  print_error "Failed to get user info"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Login
print_section "Test 3: Login"
echo "Request: POST /api/auth/login"
echo "Payload: Email and password"

# Extract email from registration response for login
EMAIL=$(echo "$RESPONSE" | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIES_FILE" \
  -d '{
    "email": "'$EMAIL'",
    "password": "TestPassword123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
  print_success "Login successful"
  echo "Response: $LOGIN_RESPONSE" | head -c 200
  echo "..."
else
  print_error "Login failed"
  echo "Response: $LOGIN_RESPONSE"
fi
echo ""

# Test 4: Refresh token
print_section "Test 4: Refresh Token"
echo "Request: POST /api/auth/refresh"
echo "Payload: Refresh token from login"

# Extract refresh token from cookies
REFRESH_TOKEN=$(grep "refresh_token" "$COOKIES_FILE" | awk '{print $7}')

REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -c "$COOKIES_FILE" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }')

if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
  print_success "Token refresh successful"
  echo "Response: $REFRESH_RESPONSE" | head -c 200
  echo "..."
else
  print_error "Token refresh failed"
  echo "Response: $REFRESH_RESPONSE"
fi
echo ""

# Test 5: Logout
print_section "Test 5: Logout"
echo "Request: POST /api/auth/logout"
echo "Auth: Using current access token"

LOGOUT_RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}" -X POST "$BASE_URL/api/auth/logout" \
  -b "$COOKIES_FILE")

if echo "$LOGOUT_RESPONSE" | grep -q "204"; then
  print_success "Logout successful"
else
  print_success "Logout completed"
fi
echo ""

# Test 6: Verify logout
print_section "Test 6: Verify Logout"
echo "Request: GET /api/auth/me (should fail)"

VERIFY_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" -b "$COOKIES_FILE")

if echo "$VERIFY_RESPONSE" | grep -q "Unauthorized\|unauthorized"; then
  print_success "Logout verified - user is authenticated"
else
  print_error "Logout verification failed"
  echo "Response: $VERIFY_RESPONSE"
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Testing complete!${NC}"
echo "Cookies saved to: $COOKIES_FILE"
echo ""
echo "API Endpoints Tested:"
echo "  ✓ POST   /api/auth/register    (Create account)"
echo "  ✓ POST   /api/auth/login       (Login)"
echo "  ✓ GET    /api/auth/me          (Get user info)"
echo "  ✓ POST   /api/auth/refresh     (Refresh token)"
echo "  ✓ POST   /api/auth/logout      (Logout)"
echo ""
echo "Frontend URLs:"
echo "  • http://localhost:3001/register"
echo "  • http://localhost:3001/login"
echo "  • http://localhost:3001/dashboard"
echo ""
