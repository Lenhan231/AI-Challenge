# Monorepo Setup - May AI Game

## Structure
```
├── app1/          Writing Phase (Submit Resume)
│   ├── api/
│   │   ├── join.js
│   │   ├── phase.js
│   │   ├── resume/submit.js
│   │   └── _lib/
│   ├── index.html
│   └── vercel.json
│
├── app2/          Voting Phase + Host Panel
│   ├── api/
│   │   ├── vote.js
│   │   ├── cv.js
│   │   ├── phase.js
│   │   ├── results.js
│   │   ├── stats.js
│   │   ├── reset.js
│   │   └── _lib/
│   ├── index.html
│   ├── host.html
│   └── vercel.json
│
└── (shared Redis database)
```

## Local Testing

### Terminal 1 - App 1 (Writing)
```bash
cd app1
vercel dev --port 3000
```
Visit: `http://localhost:3000` — Players write resumes

### Terminal 2 - App 2 (Voting + Host)
```bash
cd app2
vercel dev --port 3001
```
Visit: `http://localhost:3001` — Players vote
Visit: `http://localhost:3001/host` — Host panel

## Environment Variables

Both apps use same `.env`:
```
GEMINI_API_KEY=...
GROQ_API_KEY=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

## Deploy to Vercel

When ready to deploy:

### App 1 (Writing)
```bash
cd app1
vercel deploy --prod --token YOUR_VERCEL_TOKEN
```

### App 2 (Voting + Host)
```bash
cd app2
vercel deploy --prod --token YOUR_VERCEL_TOKEN
```

## Game Flow

1. Player goes to **App 1** → Write resume (3 min)
2. Host (in **App 2**) clicks "Start voting"
3. Player goes to **App 2** → Vote (10 min) + Host views results
