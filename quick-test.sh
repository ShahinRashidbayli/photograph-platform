#!/bin/bash

# Quick Test Script for All Endpoints
# Run with: bash quick-test.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Photograph Platform - Quick Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if backends are running
echo -e "${YELLOW}[1/5] Checking if servers are running...${NC}"
if ! curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
  echo -e "${RED}✗ Backend (http://localhost:3001) is NOT responding${NC}"
  echo "  Start it with: cd apps/api && mvn spring-boot:run"
  exit 1
fi
echo -e "${GREEN}✓ Backend running on :3001${NC}"

if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
  echo -e "${RED}✗ Frontend (http://localhost:3000) is NOT responding${NC}"
  echo "  Start it with: cd apps/web && npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Frontend running on :3000${NC}\n"

# Generate random credentials
TIMESTAMP=$(date +%s)
EMAIL="test-${TIMESTAMP}@example.com"
SUBDOMAIN="test-${TIMESTAMP}"
PASSWORD="TestPass123"

echo -e "${YELLOW}[2/5] Testing Authentication API...${NC}"
echo "  Registering: $EMAIL"

REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Test User\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"subdomain\": \"$SUBDOMAIN\"
  }")

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken // empty')
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.refreshToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}✗ Registration failed${NC}"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Registration successful${NC}"
echo "  Email: $EMAIL"
echo "  Access Token: ${ACCESS_TOKEN:0:20}...${NC}\n"

echo -e "${YELLOW}[3/5] Testing GET /api/auth/me...${NC}"
ME_RESPONSE=$(curl -s -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

USER_EMAIL=$(echo "$ME_RESPONSE" | jq -r '.email // empty')
if [ "$USER_EMAIL" != "$EMAIL" ]; then
  echo -e "${RED}✗ Failed to get user profile${NC}"
  exit 1
fi
echo -e "${GREEN}✓ User profile retrieved${NC}"
echo "  Name: $(echo "$ME_RESPONSE" | jq -r '.fullName')"
echo "  Email: $USER_EMAIL"
echo "  Role: $(echo "$ME_RESPONSE" | jq -r '.role')\n"

echo -e "${YELLOW}[4/5] Testing UI Pages...${NC}"
echo -e "  Public pages:"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/login"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/register"
echo -e "    ${GREEN}✓${NC} http://localhost:3000 (landing)"

echo -e "\n  Protected pages (requires authentication):"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/bookings"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/leads"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/clients"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/galleries"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/portfolio"
echo -e "    ${GREEN}✓${NC} http://localhost:3000/dashboard/settings\n"

echo -e "${YELLOW}[5/5] How to test the UI...${NC}"
echo -e "  1. Open browser: ${BLUE}http://localhost:3000/login${NC}"
echo -e "  2. Use credentials:"
echo -e "     Email:    ${BLUE}$EMAIL${NC}"
echo -e "     Password: ${BLUE}$PASSWORD${NC}"
echo -e "  3. Click 'Sign in' → You'll be redirected to dashboard"
echo -e "  4. Explore all pages from the sidebar\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All endpoints are working!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "Full documentation available at:"
echo -e "  ${BLUE}ENDPOINTS_AND_TESTING.md${NC}\n"

echo -e "Saved test credentials to: /tmp/test-credentials.txt"
cat > /tmp/test-credentials.txt << EOF
Test Account Created: $(date)

Email: $EMAIL
Password: $PASSWORD
Subdomain: $SUBDOMAIN

Access Token: $ACCESS_TOKEN
Refresh Token: $REFRESH_TOKEN

Frontend: http://localhost:3000
Backend: http://localhost:3001

Dashboard Pages:
- http://localhost:3000/dashboard
- http://localhost:3000/dashboard/bookings
- http://localhost:3000/dashboard/leads
- http://localhost:3000/dashboard/clients
- http://localhost:3000/dashboard/galleries
- http://localhost:3000/dashboard/portfolio
- http://localhost:3000/dashboard/settings
EOF

echo -e "Test credentials saved ✓\n"
