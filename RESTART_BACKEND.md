# Backend Restart Instructions

## The Issue
The backend is running OLD code. Your logs show:
```
ℹ️  No active tasks found for project 5
```

But the NEW code (now saved in task_manager.py) should show:
```
⚠️  No tasks yet - set pending cancellation for project 5
   Any tasks created for this project will be immediately cancelled
ℹ️  No active tasks found for project 5 - pending cancellation set
```

## How to Restart Backend

### Option 1: Full Restart (Recommended)
```bash
cd /home/user/demo3
docker compose down
docker compose up --build
```

### Option 2: Quick Restart
```bash
cd /home/user/demo3
docker compose restart server
```

**⚠️ IMPORTANT**: Option 1 with `--build` flag is recommended to ensure Python modules are fully reloaded.

## What to Look For After Restart

1. **Test the race condition fix:**
   - Open the recommendations page in browser
   - Click "Run Analysis"
   - IMMEDIATELY click "Reset" (within 1 second)

2. **Check backend logs - you should now see:**
   ```
   🔔 CANCEL ALL TASKS REQUEST for project: 5
   📋 Total active tasks: 0
   ⚠️  No tasks yet - set pending cancellation for project 5
      Any tasks created for this project will be immediately cancelled
   ℹ️  No active tasks found for project 5 - pending cancellation set
   ✅ Returning response with cancelled_count: 0

   ✅ Created task xxx-xxx-xxx (llm_analysis)
   ⚠️  Task xxx-xxx-xxx created but project 5 has pending cancellation - cancelling immediately
   ✅ Created task xxx-xxx-xxx (llm_analysis) - IMMEDIATELY CANCELLED

   🔍 Starting LLM analysis for VMs...
   🛑 Task xxx-xxx-xxx was cancelled. Stopping VM analysis. Processed 0/101
   ```

3. **SUCCESS**: Processing stops at iteration 0 or 1, NOT continuing through all 101 VMs

4. **OLD CODE (what you're seeing now)**: Processing continues [1/101], [2/101], [3/101]...

## Verification

The key difference is:
- **OLD**: "ℹ️ No active tasks found" → task created → processes all 101 VMs
- **NEW**: "⚠️ No tasks yet - set pending cancellation" → task created → "IMMEDIATELY CANCELLED" → stops at iteration 0

This pending cancellation flag solves the race condition where clicking Reset super fast causes the cancel request to arrive BEFORE the task is created.
