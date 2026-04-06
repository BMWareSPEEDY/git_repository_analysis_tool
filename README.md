# 🧠 AI Codebase Explainer

A full-stack AI developer tool that clones GitHub repositories, analyzes code structure, generates AI-powered explanations for every file, provides architecture summaries, and lets you ask questions about any codebase.

**Powered by Google Gemini 3 Flash** · **100% Local-First** · **No Database Required**

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Git**
- **Google Gemini API Key** → [Get one here](https://aistudio.google.com/apikey)

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

The backend will run at **http://localhost:8000**.

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will run at **http://localhost:5173**.

### 3. Use It

1. Open **http://localhost:5173** in your browser
2. Paste any public GitHub repository URL
3. Click **"Analyze"**
4. Browse the file tree, read AI explanations, and ask questions!

---

## 📁 Project Structure

```
github_repo_summerizer/
├── backend/
│   ├── main.py              # FastAPI server & routes
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   ├── services/
│   │   ├── repo.py          # Git cloning service
│   │   ├── scanner.py       # File discovery service
│   │   └── ai.py            # Gemini AI integration
│   └── utils/
│       └── file_utils.py    # File I/O & hashing utilities
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Router
│   │   ├── api.js           # Backend API client
│   │   ├── index.css        # Global styles & theme
│   │   ├── pages/
│   │   │   ├── HomePage.jsx # Landing page with URL input
│   │   │   └── RepoPage.jsx # 3-panel analysis view
│   │   └── components/
│   │       ├── FileTree.jsx        # Hierarchical file browser
│   │       ├── ExplanationPanel.jsx # AI file explanation viewer
│   │       ├── ChatPanel.jsx        # Q&A chat interface
│   │       └── RepoSummary.jsx      # Architecture overview
│   └── vite.config.js       # Vite + Tailwind config
└── data/                    # Auto-created at runtime
    ├── repos/               # Cloned repositories
    ├── summaries/           # Per-file AI explanations (cached)
    └── repo_summaries/      # Architecture summaries (cached)
```

---

## 🔌 API Endpoints

| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| POST   | `/clone`                  | Clone a GitHub repo                |
| GET    | `/repo/{id}/files`        | List all code files                |
| GET    | `/repo/{id}/file-summary` | Get AI explanation for a file      |
| POST   | `/repo/{id}/analyze`      | Trigger full analysis (background) |
| GET    | `/repo/{id}/status`       | Get analysis progress              |
| GET    | `/repo/{id}/summary`      | Get architecture summary           |
| POST   | `/ask`                    | Ask a question about the codebase  |

---

## ⚡ Features

- **🔍 Smart File Scanner** — Supports 30+ file extensions across all major languages
- **🤖 AI Explanations** — Purpose, key logic, and dependencies for every file
- **🏗️ Architecture Summary** — High-level overview of the entire project
- **💬 Q&A Chat** — Ask questions about the codebase with full context
- **📦 Disk Caching** — All AI outputs cached to avoid recomputation
- **🎨 VS Code-inspired UI** — Dark theme with file tree, panels, and status bar
- **🚀 Background Analysis** — Analyze repos without blocking the UI

---

## 🛠️ Tech Stack

| Layer    | Technology              |
|----------|------------------------|
| Frontend | React + Vite           |
| Styling  | Tailwind CSS v4        |
| Backend  | Python + FastAPI       |
| AI       | Google Gemini 3 Flash  |
| Storage  | Local filesystem (JSON)|

---

## 📝 License

MIT
