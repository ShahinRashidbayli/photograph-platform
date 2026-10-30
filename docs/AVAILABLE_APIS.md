# Available APIs for Testing

**Status**: ✅ Ready for testing at `http://localhost:3001`

---

## 📦 Available Endpoints

### 1. **POST /api/auth/register** ✅
**Register a new photographer account with studio details**

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

**Fields:**
| Field | Type | Validation |
|-------|------|-----------|
| `fullName` | string | Required, max 200 chars |
| `email` | string | Required, valid email |
| `password` | string | Required, min 8 chars |
| `subdomain` | string | Required, 3-63 chars (alphanumeric + hyphens) |

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "anna@fotografie.de",
  "fullName": "Anna Fischer",
  "role": "OWNER",
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "subdomain": "anna-fischer",
    "plan": "FREE"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Testing Frontend:** `http://localhost:3001/register` → Photographer role → Fill form → Click "Go live"

---

### 2. **POST /api/auth/login** ✅
**Login with email and password**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "anna@fotografie.de",
    "password": "SecurePass123"
  }'
```

**Fields:**
| Field | Type | Validation |
|-------|------|-----------|
| `email` | string | Required, valid email |
| `password` | string | Required, min 8 chars |

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Cookies:** Auth tokens set as HTTP-only cookies automatically

**Testing Frontend:** `http://localhost:3001/login` → Enter credentials → Click "Sign in" → Redirects to `/dashboard`

---

### 3. **GET /api/auth/me** ✅
**Get current authenticated user profile**

```bash
curl http://localhost:3001/api/auth/me \
  -H "Cookie: access_token=<your-token>"
```

**Authentication:** Required (JWT token in cookie)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "anna@fotografie.de",
  "fullName": "Anna Fischer",
  "role": "OWNER",
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "subdomain": "anna-fischer",
    "plan": "FREE"
  }
}
```

---

### 4. **POST /api/auth/refresh** ✅
**Refresh access token using refresh token**

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your-refresh-token>"
  }'
```

**Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `refreshToken` | string | From login response or cookie |

**Response:**
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

**Token Expiry:**
- Access token: 24 hours
- Refresh token: 30 days

---

### 5. **POST /api/auth/logout** ✅
**Logout and clear authentication**

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Cookie: access_token=<your-token>"
```

**Authentication:** Required

**Response:** HTTP 204 No Content

**Side Effects:**
- Clears auth cookies
- Invalidates refresh tokens

---

## 🚀 Quick Testing

### Run Automated Test Script
```bash
cd /Users/shahinrashidbayli/RiderProjects/photograph-platform
bash scripts/test-auth.sh http://localhost:3001
```

This script will:
1. ✓ Register a new photographer
2. ✓ Get user profile
3. ✓ Login
4. ✓ Refresh token
5. ✓ Logout
6. ✓ Verify logout

---

## 🧪 Manual Testing Scenarios

### Scenario 1: Complete Registration Flow
```bash
# 1. Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "fullName": "Test User",
    "email": "test'$(date +%s)'@example.com",
    "password": "TestPass123",
    "subdomain": "test-'$(date +%s)'"
  }'

# 2. Get user profile
curl http://localhost:3001/api/auth/me -b cookies.txt

# 3. Logout
curl -X POST http://localhost:3001/api/auth/logout -b cookies.txt
```

### Scenario 2: Login Flow
```bash
# 1. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# 2. Use token to access protected resource
curl http://localhost:3001/api/auth/me -b cookies.txt

# 3. Logout
curl -X POST http://localhost:3001/api/auth/logout -b cookies.txt
```

---

## ⚙️ Frontend Redirects

All auth flows now redirect to `/dashboard`:

| Page | Action | Redirect |
|------|--------|----------|
| `/register` | Photographer registration | `/dashboard` |
| `/register` | Client registration (mocked) | Show confirmation |
| `/login` | Successful login | `/dashboard` |
| `/dashboard` | Access without auth | `/login` |

---

## 🔍 Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid email format"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid credentials"
}
```

### 409 Conflict
```json
{
  "error": "Subdomain already taken"
}
```

---

## 📱 Frontend Testing URLs

| Page | URL | Purpose |
|------|-----|---------|
| Registration | `http://localhost:3001/register` | Create new account |
| Login | `http://localhost:3001/login` | Sign in to account |
| Dashboard | `http://localhost:3001/dashboard` | Protected dashboard |

---

## ✨ Features

| Feature | Status | Notes |
|---------|--------|-------|
| Photographer Registration | ✅ | Full with studio setup |
| Email/Password Login | ✅ | Standard flow |
| Token Refresh | ✅ | Auto-refresh on 401 |
| User Profile | ✅ | Full user + tenant info |
| Logout | ✅ | Clears cookies |
| Customer Registration | 🟡 | UI ready, backend pending |
| Magic Link Login | 🟡 | UI ready, backend pending |
| Email Verification | 🟡 | Planned |
| Password Recovery | 🟡 | Planned |

---

## 🛠️ Troubleshooting

**"Subdomain already taken"**
- Use unique subdomains with timestamps: `anna-fischer-1234567890`

**"Invalid email format"**
- Make sure email has valid format: `user@domain.com`

**"Password must be at least 8 characters"**
- Use passwords with 8+ characters and mixed case

**"Authentication required"**
- Make sure access token is valid and not expired

**"Token expired"**
- Use `/api/auth/refresh` to get new access token

---

## 📊 API Call Examples

### JavaScript (fetch)
```javascript
// Register
const response = await fetch('http://localhost:3001/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Anna Fischer',
    email: 'anna@fotografie.de',
    password: 'TestPassword123',
    subdomain: 'anna-fischer'
  })
});

const data = await response.json();
console.log(data.accessToken);
```

### Python (requests)
```python
import requests

response = requests.post('http://localhost:3001/api/auth/register', json={
    'fullName': 'Anna Fischer',
    'email': 'anna@fotografie.de',
    'password': 'TestPassword123',
    'subdomain': 'anna-fischer'
})

print(response.json()['accessToken'])
```

---

## 📞 Next Steps

### For Backend Team
1. Implement email detection endpoint (`GET /api/auth/check-email`)
2. Add customer registration support with role parameter
3. Implement magic link generation and verification
4. Add studio profile update endpoint

### For Frontend Team
1. Connect real magic link flow once backend is ready
2. Add email verification flow
3. Implement password recovery
4. Add 2FA support

---

**Last Updated**: 2026-04-24  
**Environment**: Development (localhost)  
**API Version**: v1
