# Local Testing Guide

## Prerequisites
- Node.js installed
- Vercel CLI: `npm install -g vercel`
- `.env` files already configured in both `app1/` and `app2/` with Redis credentials

## Test Flow

### Terminal 1: Start App 1 (Writing Phase)
```bash
cd c:\Users\nhanl\OneDrive\Desktop\AI-Challenge\app1
vercel dev --port 3000
```
Visit: **http://localhost:3000** → Player enters MSSV, waits for writing phase to start

### Terminal 2: Start App 2 (Voting + Host Panel)
```bash
cd c:\Users\nhanl\OneDrive\Desktop\AI-Challenge\app2
vercel dev --port 3001
```
Visit: **http://localhost:3001** → Player votes on resumes  
Visit: **http://localhost:3001/host** → Host control panel

---

## Local Test Checklist

### 1. Verify Connection
- [ ] App 1 loads at localhost:3000 without errors
- [ ] App 2 loads at localhost:3001 without errors
- [ ] Host panel loads at localhost:3001/host
- [ ] Check browser console for any errors

### 2. Test Writing Phase (App 1)
- [ ] Player 1: Login with MSSV (e.g., `SE190525`)
- [ ] See "Chờ...: Waiting for host to start writing phase"
- [ ] Open another tab as Player 2 with different MSSV

### 3. Host Triggers Writing Phase (App 2)
- [ ] Go to localhost:3001/host
- [ ] Click "Bắt đầu viết" button
- [ ] Player 1 & 2 should immediately see:
  - Job title: "Nhân Viên May"
  - 3-minute timer starts counting down
  - Textarea appears to write resume

### 4. Test Resume Submission
- [ ] Player 1: Write resume, click "Nộp"
- [ ] Host panel should show player count increase
- [ ] Player 2: Write resume, click "Nộp"
- [ ] Host panel "Xem CV" should show 2 human resumes + 2 AI resumes (1:1 ratio)

### 5. Host Triggers Voting Phase (App 2)
- [ ] Click "Bắt đầu vote" on host panel
- [ ] Phase changes to voting (10-minute timer)
- [ ] Players 1 & 2 redirected to app2 automatically (or navigate to localhost:3001)
- [ ] Both see resume cards with Hire/Reject buttons

### 6. Test Voting
- [ ] Player 1: Hire/Reject 5 resumes
  - Buttons disable after click (prevent double-click)
  - Next card loads without errors
  - Check "Already voted" error doesn't appear
- [ ] Player 2: Vote on same resumes
  - Different shuffled order (seeded by MSSV)
  - Player's own resume should never appear

### 7. Host Sees Results (App 2)
- [ ] Click "Xem kết quả" on host panel
- [ ] Stats show:
  - **Player count**: 2
  - **AI Hire Rate**: % (e.g., 60%)
  - **Human Hire Rate**: % (e.g., 40%)
  - Bar chart compares AI vs Human

### 8. Verify Resume Deletion (App 2)
- [ ] "Xem CV" → Click delete (🗑️) on one resume
- [ ] Resume disappears from list
- [ ] Vote count adjusts accordingly

---

## Common Issues & Fixes

### "Cannot connect to Redis"
- Check .env files have `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- Verify Redis endpoint is accessible: `curl -H "Authorization: Bearer YOUR_TOKEN" https://smooth-quetzal-166376.upstash.io/ping`

### "MSSV required" on App 1
- Refresh browser (sessionStorage clears)
- Enter MSSV again
- Should persist across page refreshes until tab is closed

### Resume card shows "undefined" text
- Check browser console for API errors
- Verify `/api/vote` endpoint returns `{resumeId, text}`
- Check Redis has `resume:ai:*` or `resume:human:*` keys

### Host phase change doesn't reflect on players
- Both apps must share same Redis instance
- Player should poll `/api/phase` every 1.5 seconds
- Check network tab: /api/phase should return current phase

### "Already voted on this resume"
- Should only happen with double-click (which disables buttons)
- If persists: clear sessionStorage, refresh page

---

## Redis Debugging (Optional)

### Connect to Redis CLI via Upstash
```bash
# Via curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://smooth-quetzal-166376.upstash.io/get/game:phase
```

### Check Game State
```
game:phase              → Current phase (writing|voting|results)
resumes:human           → Set of human resume IDs
resumes:ai              → Set of AI resume IDs
vote:PLAYERID:seen      → Set of voted resumes
```

---

## When Ready for Production
1. Verify all local tests pass
2. Deploy app1 to Vercel: `vercel deploy --prod --token YOUR_TOKEN` (from MONOREPO_SETUP.md)
3. Deploy app2 to Vercel separately
4. Update host to use production URLs instead of localhost

