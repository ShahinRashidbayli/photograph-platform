# Auth Flow Testing Guide

## Quick Start

### Development URLs
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080 (Spring Boot)

### Test Credentials (if seeded in DB)
```
Email: test@fotografie.de
Password: TestPassword123
Subdomain: test-studio
```

---

## 📊 Available APIs for Testing

### ✅ Working Endpoints

#### 1. **POST /api/auth/register** - Create Photographer Account
Register a new photographer with studio details.

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Anna Fischer",
    "email": "anna@fotografie.de",
    "password": "SecurePass123",
    "subdomain": "anna-fischer"
  }'
```

**Required Fields:**
- `fullName` - User's full name (max 200 chars)
- `email` - Valid email address
- `password` - Min 8 characters
- `subdomain` - 3-63 chars, alphanumeric + hyphens only

**Response:**
```json
{
  "id": "uuid",
  "email": "anna@fotografie.de",
  "fullName": "Anna Fischer",
  "role": "OWNER",
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

---

#### 2. **POST /api/auth/login** - Login
Login with email and password.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "anna@fotografie.de",
    "password": "SecurePass123"
  }'
```

**Response:**
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

Tokens are set as HTTP-only cookies automatically.

---

#### 3. **GET /api/auth/me** - Get Current User
Get authenticated user's profile information.

```bash
curl http://localhost:3001/api/auth/me \
  -H "Cookie: access_token=<your-token>"
```

**Response:**
```json
{
  "id": "uuid",
  "email": "anna@fotografie.de",
  "fullName": "Anna Fischer",
  "role": "OWNER",
  "tenant": {
    "subdomain": "anna-fischer",
    "plan": "FREE"
  }
}
```

---

#### 4. **POST /api/auth/logout** - Logout
Logout and clear authentication cookies.

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Cookie: access_token=<your-token>"
```

---

#### 5. **POST /api/auth/refresh** - Refresh Token
Get a new access token using refresh token.

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh-token>"}'
```

---

## 🧪 Testing the Frontend Flows

### Login Flow
1. Go to http://localhost:3001/login
2. Enter email: `anna@fotografie.de`
3. Enter password: `SecurePass123`
4. Click "Sign in" → Should redirect to `/dashboard`

### Registration Flow (Photographer)
1. Go to http://localhost:3001/register
2. Click "Photographer" role
3. Fill in form:
   - Full name: `Anna Fischer`
   - Email: `anna@fotografie.de`
   - Password: `SecurePass123`
4. Click "Continue" → Go to studio setup
5. Fill in studio form:
   - Studio name: `Anna Fischer Fotografie`
   - Subdomain: `anna-fischer` (auto-slugged)
   - City: `Berlin`
   - Select session types
6. Click "Go live" → Should redirect to `/dashboard`

### Registration Flow (Customer)
1. Go to http://localhost:3001/register
2. Click "Client" role
3. Fill in form:
   - Full name: `Maria Kellner`
   - Email: `maria@example.com`
4. Click "Send magic link" → Shows magic link confirmation screen
5. **Note**: Magic link flow is mocked (no actual email sent yet)

---

## 🔧 Testing with cURL

### Test Registration
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "fullName": "Test User",
    "email": "test.user@example.com",
    "password": "TestPass123",
    "subdomain": "test-user"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test.user@example.com",
    "password": "TestPass123"
  }'
```

### Test Authenticated Request
```bash
curl http://localhost:3001/api/auth/me \
  -b cookies.txt
```

---

## 📋 Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Photographer Registration | ✅ Working | Full 3-step flow with all fields |
| Photographer Login | ✅ Working | Email + password based |
| Customer Registration | 🟡 Mocked | UI ready, backend support pending |
| Magic Link Verification | 🟡 Mocked | UI ready, backend support pending |
| Email Detection | ✅ Built | Uses real POST /api/auth/login |
| Studio Setup Storage | 🟡 Partial | Collected in UI, not stored yet |
| Session Types | 🟡 Partial | Collected in UI, not stored yet |
| Refresh Token | ✅ Working | Auto-refresh on 401 |
| Token Rotation | ✅ Working | 24h access, 30d refresh |

---

## 🚀 What's Next

### Backend Tasks
1. Implement `GET /api/auth/check-email` - Check email and return user role
2. Implement customer registration with `role=CUSTOMER` parameter
3. Implement `POST /api/auth/magic-link` - Generate and send magic links
4. Implement `GET /api/auth/magic-link/verify` - Verify magic link tokens
5. Add studio profile storage endpoint

### Frontend Tasks
1. Connect real magic link flow once backend is ready
2. Add email verification before registration
3. Add password recovery flow
4. Add session management (remember device, etc.)

---

## 🐛 Known Issues

1. **Subdomain must be unique** - Try using timestamps or UUIDs in test emails
2. **Password must be 8+ characters** - Error returned if too short
3. **Invalid credentials show generic error** - For security
4. **Customer registration is mocked** - Shows success UI without actual registration

---

## 💡 Tips

- Use [Postman](https://www.postman.com/) to test APIs easily
- Check browser DevTools > Network tab to see API requests
- Use `http://localhost:3001/api/auth/me` to verify login state
- Check Application > Cookies to see auth tokens
