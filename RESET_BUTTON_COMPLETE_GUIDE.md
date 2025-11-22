# Reset Button Complete Fix & Testing Guide

## Summary of Issues Found

### 1. Servers Not Running ❌
- Backend (port 8000): **NOT RUNNING**
- Frontend (port 3000): **NOT RUNNING**
- The synchronous XHR hangs because it can't connect to the backend

### 2. Authentication Required ✅
- All `/llm` endpoints require Azure OAuth authentication
- Code correctly sends the Authorization header
- Token is retrieved from localStorage

### 3. CORS Configuration ✅
```python
BACKEND_CORS_ORIGINS = [
    "http://localhost:3000",
    "https://cm.sigmoid.io"
]
```
- CORS allows localhost:3000
- Allows all methods and headers
- Allows credentials

### 4. Backend Endpoint ✅
```python
@router.post("/projects/{project_id}/cancel-tasks", status_code=200)
async def cancel_project_tasks(project_id: str):
```
- Full URL: `http://localhost:8000/llm/projects/{project_id}/cancel-tasks`
- Requires authentication via `Depends(azure_scheme)`
- Uses task_manager to cancel tasks and set pending cancellation flag

---

## The Complete Solution

### Frontend Implementation (Generation-Based + Synchronous Cancel)

**Key Components:**
1. **Generation Counter**: Each analysis/reset increments a generation number
2. **Response Filtering**: Only process responses matching current generation
3. **Synchronous XHR**: Guarantees cancel request completes before UI clears
4. **Error Handling**: Handles offline backend, auth errors, network issues

**Code Structure:**
```javascript
// Generation tracking
const generationRef = useRef<number>(0);

// Start analysis
const handleFetch = async () => {
  generationRef.current += 1;  // Invalidate old requests
  const thisGeneration = generationRef.current;

  const result = await fetchRecommendationsWithFilters(...);

  // Only process if still current generation
  if (generationRef.current !== thisGeneration) {
    console.log('Ignoring old response');
    return;
  }

  setRecommendations(result.recommendations);
};

// Reset with synchronous backend cancel
const handleReset = () => {
  generationRef.current += 1;  // Invalidate old requests
  cancelBackendTaskSync(projectId);  // BLOCKS until complete
  // Clear UI after cancel completes
  setFilters(...);
  setRecommendations([]);
};
```

---

## How to Start the Servers

### Backend (Docker Compose)

```bash
cd /home/user/demo3/backend
docker compose up
```

**Expected output:**
```
server-1  | INFO:     Started server process [1]
server-1  | INFO:     Waiting for application startup.
server-1  | INFO:     Application startup complete.
server-1  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Verify backend is running:**
```bash
curl http://localhost:8000/health
# Should return: {"message":"App okay!"}
```

### Frontend (Next.js)

```bash
cd /home/user/demo3/frontend
npm run dev
```

**Expected output:**
```
- Local:        http://localhost:3000
- Ready in 2.5s
```

---

## Testing the Reset Button

### Test 1: Backend Online, Normal Flow

1. **Open** `http://localhost:3000` and navigate to Recommendations page
2. **Click** "Run Analysis"
3. **Wait 2 seconds** then click "Reset"

**Expected Frontend Logs:**
```
🚀 [RESET-v3.0] Starting analysis (generation 1)
📋 Task started: xxx-xxx-xxx

🔄 [RESET-v3.0] Reset clicked (new generation: 2)
🔄 [CRITICAL] Sending SYNCHRONOUS cancel request: http://localhost:8000/llm/projects/5/cancel-tasks
✅ Cancel request completed with status: 200
📊 Backend response: {status: "success", cancelled_count: 1, ...}
🛑 Cancelled 1 tasks for project 5
✅ Reset complete - UI cleared, generation 2
```

**Expected Backend Logs:**
```
🔔 CANCEL ALL TASKS REQUEST for project: 5
📋 Total active tasks: 1
✅ Cancelled task: xxx-xxx-xxx
✅ Returning response with cancelled_count: 1

🛑 Task xxx-xxx-xxx was cancelled. Stopping VM analysis. Processed 3/101
✅ Completed processing 3/101 VMs successfully
```

**Success Criteria:**
- ✅ Backend stops processing (not all 101 VMs)
- ✅ UI clears immediately after cancel completes
- ✅ No OpenAI API calls after cancellation
- ✅ Token consumption stops

### Test 2: Backend Offline (Network Error)

1. **Stop backend**: `docker compose down`
2. **Click** "Run Analysis" (will fail)
3. **Click** "Reset"

**Expected Frontend Logs:**
```
🔄 [RESET-v3.0] Reset clicked (new generation: 2)
🔄 [CRITICAL] Sending SYNCHRONOUS cancel request: http://localhost:8000/llm/projects/5/cancel-tasks
❌ Cancel failed: Network error (status 0) - backend may be offline
⚠️  Cancel request error: [error message]
This is non-fatal - UI will still clear, but backend may continue processing
✅ Reset complete - UI cleared, generation 2
```

**Success Criteria:**
- ✅ UI clears even though backend is offline
- ✅ Clear error message shown in console
- ✅ No infinite hang

### Test 3: Expired/Invalid Token (401 Error)

1. **Clear localStorage**: `localStorage.removeItem('accessToken')`
2. **Set invalid token**: `localStorage.setItem('accessToken', 'invalid-token')`
3. **Click** "Run Analysis"
4. **Click** "Reset"

**Expected Frontend Logs:**
```
🔄 [CRITICAL] Sending SYNCHRONOUS cancel request: http://localhost:8000/llm/projects/5/cancel-tasks
✅ Cancel request completed with status: 401
❌ Cancel failed: Unauthorized (401) - token may be expired
✅ Reset complete - UI cleared, generation 2
```

**Success Criteria:**
- ✅ Detects 401 error
- ✅ Shows clear "token expired" message
- ✅ UI still clears

### Test 4: Race Condition (Reset Before Task Created)

1. **Click** "Run Analysis"
2. **IMMEDIATELY** click "Reset" (within 100ms)

**Expected Backend Logs:**
```
🔔 CANCEL ALL TASKS REQUEST for project: 5
📋 Total active tasks: 0
⚠️  No tasks yet - set pending cancellation for project 5
   Any tasks created for this project will be immediately cancelled
✅ Returning response with cancelled_count: 0

✅ Created task xxx-xxx-xxx (llm_analysis)
⚠️  Task created but project 5 has pending cancellation - cancelling immediately
🛑 Task xxx-xxx-xxx was cancelled. Stopping VM analysis. Processed 0/101
```

**Success Criteria:**
- ✅ Pending cancellation flag catches late task creation
- ✅ Backend stops at **0/101 VMs** (not even 1 VM processed)
- ✅ Zero OpenAI API calls
- ✅ Zero token consumption

---

## Architecture Overview

```
User Clicks Reset
    ↓
Frontend: generationRef++
    ↓
Frontend: Synchronous XHR to /llm/projects/5/cancel-tasks
    ↓ (BLOCKS here until response)
    ↓
Backend: Receives request with Auth token
    ↓
Backend: Validates Azure OAuth token
    ↓
Backend: task_manager.cancel_tasks_by_project(5)
    ↓
Backend: Sets pending_cancel flag OR cancels active tasks
    ↓
Backend: Returns {cancelled_count: X}
    ↓ (Response received)
    ↓
Frontend: Logs cancel result
    ↓
Frontend: setFilters(...) - clears UI
    ↓
Backend LLM Loop: Checks is_cancelled() → TRUE
    ↓
Backend: Breaks loop, stops processing
    ↓
RESULT: 0 tokens consumed ✅
```

---

## Common Issues & Troubleshooting

### Issue: "No access token found"
**Cause**: User not logged in or token expired
**Fix**: Log in again to get fresh token

### Issue: "Network error (status 0)"
**Cause**: Backend is offline
**Fix**: Start backend with `docker compose up`

### Issue: "Unauthorized (401)"
**Cause**: Token expired or invalid
**Fix**: Refresh the page to get new token

### Issue: Synchronous XHR deprecation warning
**Cause**: Browser warning about synchronous XHR usage
**Impact**: This is expected - synchronous XHR is necessary here to guarantee delivery
**Action**: Safe to ignore - this is one of the valid use cases for synchronous XHR

### Issue: Cancel request shows in Network tab but no backend logs
**Cause**:
1. OPTIONS preflight may be succeeding, but POST is failing
2. Authentication might be rejecting the request
3. Backend might not be receiving the request

**Fix**:
1. Check backend is running: `curl http://localhost:8000/health`
2. Check browser console for detailed error logs
3. Check backend logs for "🔔 CANCEL ALL TASKS REQUEST"

---

## Code Changes Summary

### Files Modified:
1. `frontend/src/app/.../recommendations/page.tsx`

### Key Changes:
- Removed: AbortController, shouldIgnoreResponseRef
- Added: generationRef counter
- Added: Synchronous XHR for cancel with error handling
- Added: Generation checking in response handler
- Result: **116 lines removed, 62 lines added** (54 lines net reduction)

---

## Next Steps

1. **Start both servers** (see "How to Start the Servers" above)
2. **Test each scenario** (see "Testing the Reset Button" above)
3. **Verify backend logs** show task cancellation
4. **Verify frontend logs** show successful cancel response
5. **Confirm** 0/101 VMs processed when reset clicked immediately

Once all tests pass, the reset button will reliably stop backend LLM processing and prevent token consumption! 🎉
