# MCAT Trainer

A web-based MCAT practice question trainer with adaptive learning, timed sessions, and performance analytics.

## What the App Does

MCAT Trainer helps you prepare for the MCAT by:

- **Timed Practice**: Each question has a 95-second timer (matching MCAT pacing) with visual warnings at 30 and 10 seconds
- **Adaptive Learning**: The app tracks your weak areas and prioritizes questions from topics where you need more practice
- **Multiple Study Modes**: Choose between mixed practice (all subjects) or focused study (specific subjects)
- **Progress Tracking**: View detailed analytics including accuracy by chapter, 30-day trends, and areas needing improvement
- **Multi-User Support**: Switch between users to track individual progress
- **Source Citations**: Every answer includes a citation to the original Kaplan review book chapter

## Features

- 1,080 practice questions across 6 subjects:
  - Biology (180 questions)
  - Biochemistry (180 questions)
  - Behavioral Sciences (180 questions)
  - General Chemistry (180 questions)
  - Organic Chemistry (180 questions)
  - Physics and Math (180 questions)
- Configurable session length (10, 20, 30, or custom number of questions)
- Real-time session progress and accuracy
- Detailed explanations for every question
- Performance trends over time

---

## How to Run Locally

### Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- npm or yarn

### Step 1: Set Up the Backend

```bash
# Navigate to the backend folder
cd mcat-trainer-app/backend

# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

The backend will start on `http://localhost:8000`. You can verify it's working by visiting `http://localhost:8000/api/health`.

### Step 2: Set Up the Frontend

```bash
# Open a new terminal and navigate to the frontend folder
cd mcat-trainer-app/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`. Open this URL in your browser to use the app.

---

## How to Add/Update Source Materials

Questions are stored in JSON files in the project root directory. Each subject has its own file:

- `mcat_biology_questions.json`
- `mcat_biochemistry_questions.json`
- `mcat_behavioral_sciences_questions.json`
- `mcat_general_chemistry_questions.json`
- `mcat_organic_chemistry_questions.json`
- `mcat_physics_math_questions.json`

### JSON Format

Each question file has this structure:

```json
{
  "metadata": {
    "source": "Kaplan MCAT Biology Review 2026-2027",
    "subject": "Biology",
    "total_questions": 180,
    "chapters": 12
  },
  "questions": [
    {
      "id": "ch1_q1",
      "chapter": 1,
      "chapter_title": "The Cell",
      "question_number": 1,
      "question_text": "What is the primary function of...",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correct_answer": "B",
      "explanation": "The correct answer is B because..."
    }
  ]
}
```

### Adding New Questions

1. Create a new JSON file following the format above, or edit an existing one
2. Place it in the `backend/` directory (same folder as `main.py`)
3. Update the `QUESTION_FILES` list in `database.py` if adding a new subject:

```python
QUESTION_FILES = [
    ("../mcat_biology_questions.json", "Biology"),
    ("../mcat_your_new_subject_questions.json", "Your New Subject"),
    # ... etc
]
```

4. Restart the backend server to load the new questions

---

## How Citations Work

Every answer includes a citation that references the original source material:

```
Source: Kaplan MCAT Biology Review 2026-2027
Chapter 3: Enzymes
Question 7
```

Citations are generated automatically based on the question metadata:
- **Source**: The book title from the question file's metadata
- **Chapter**: The chapter number and title where the question appears
- **Question Number**: The question's position within the chapter

This helps you:
- Return to the source material for deeper study
- Understand the context of each question
- Track which chapters need more review

---

## How to Deploy for Remote Use

### Option 1: Railway (Backend) + Netlify (Frontend) - Recommended

This setup gives you free hosting for both parts of the application.

#### Deploy Backend to Railway

1. **Create a Railway Account**
   - Go to [railway.app](https://railway.app) and sign up (free tier available)

2. **Install Railway CLI** (optional, for easier deployment)
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Prepare Backend for Deployment**

   Create a `Procfile` in the `backend/` folder:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

4. **Deploy via GitHub** (easiest method)
   - Push your code to a GitHub repository
   - In Railway dashboard, click "New Project" → "Deploy from GitHub repo"
   - Select your repository and the `backend` folder
   - Railway will auto-detect Python and deploy

5. **Or Deploy via CLI**
   ```bash
   cd mcat-trainer-app/backend
   railway init
   railway up
   ```

6. **Note Your Backend URL**
   - Railway will give you a URL like `https://your-app.railway.app`
   - You'll need this for the frontend configuration

#### Deploy Frontend to Netlify

1. **Create a Netlify Account**
   - Go to [netlify.com](https://netlify.com) and sign up (free tier available)

2. **Update API URL**

   Edit `frontend/src/api.js` to use your Railway backend URL:
   ```javascript
   const API_BASE = 'https://your-app.railway.app/api';
   ```

3. **Build the Frontend**
   ```bash
   cd mcat-trainer-app/frontend
   npm run build
   ```

4. **Deploy to Netlify**

   **Option A: Drag and Drop**
   - Go to Netlify dashboard
   - Drag the `frontend/dist` folder to the deploy area

   **Option B: Via CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

   **Option C: Connect to GitHub**
   - In Netlify, click "Add new site" → "Import an existing project"
   - Connect your GitHub repo
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Set base directory: `frontend` (if your repo has both backend and frontend)

5. **Configure Redirects** (for React Router)

   Create `frontend/public/_redirects`:
   ```
   /*    /index.html   200
   ```

### Option 2: Render.com (All-in-One)

Render offers free hosting for both backend and static sites.

1. Sign up at [render.com](https://render.com)
2. Create a "Web Service" for the backend (Python)
3. Create a "Static Site" for the frontend
4. Follow similar configuration steps as above

### Option 3: Fly.io (Backend) + Vercel (Frontend)

Another free option with good performance.

---

## Environment Variables

### Backend (Railway)

No environment variables required for basic setup. Optional:
- `PORT` - Automatically set by Railway
- `ALLOWED_ORIGINS` - Comma-separated list of frontend URLs for CORS

### Frontend (Netlify)

If you want to use environment variables for the API URL:

1. In `frontend/src/api.js`, update to:
   ```javascript
   const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
   ```

2. In Netlify dashboard, add environment variable:
   - Key: `VITE_API_URL`
   - Value: `https://your-railway-app.railway.app/api`

---

## Troubleshooting

### Backend won't start
- Make sure Python 3.8+ is installed: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Check if port 8000 is available

### Frontend can't connect to backend
- Verify backend is running at `http://localhost:8000`
- Check browser console for CORS errors
- Ensure the API URL in `api.js` is correct

### Questions not loading
- Verify JSON files are in the correct location
- Check backend logs for file loading errors
- Ensure JSON files are valid (no syntax errors)

### Database issues
- Delete `mcat_trainer.db` to reset the database
- Restart the backend to recreate it

---

## Project Structure

```
mcat-trainer-app/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── database.py          # SQLite database operations
│   ├── question_selector.py # Adaptive question selection
│   ├── requirements.txt     # Python dependencies
│   └── mcat_trainer.db      # SQLite database (created on first run)
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── App.jsx          # Main app with routing
│   │   ├── api.js           # API client
│   │   └── index.css        # Styles
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
└── README.md                # This file
```

---

## License

For personal educational use only. Questions are sourced from Kaplan MCAT Review books.
