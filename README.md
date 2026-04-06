# 🧠 PEEK — Program Exploration & Examination Kit

**PEEK** is an AI-powered platform that automatically builds a **Mental Model** of any codebase — indexing not just files and functions, but architecture, dependencies, call graphs, security patterns, and behavior. It transforms chaotic, poorly-documented code into something both humans and AI agents can interact with intelligently.

**Powered by Google Gemini 3 Flash** · **100% Local-First** · **No Database Required** · **ReactFlow Visualizations**

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Git**
- **Google Gemini API Key** → [Get one here](https://aistudio.google.com/apikey)

### 1. Backend Setup

```bash
cd backend

# Create .env file with your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

The backend will run at **http://localhost:8000**.

### 2. Frontend Setup

```bash
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
4. Explore:
   - 📄 **Code View** — File-by-file AI explanations
   - 🧠 **Mental Model** — Interactive architecture graph (ReactFlow)
   - 🔒 **Insights** — Security findings & code smells
   - 💬 **Query Engine** — Ask natural-language questions

---

## ✨ Key Features

### 🧠 Automated Code Indexing & Mental Model
- Parses files across **30+ languages** using AST (Python) and regex fallback
- Extracts **call graphs**, **class hierarchies**, and **dependency trees**
- Detects **code smells** and architectural inconsistencies
- Visualized interactively via **ReactFlow**

### 💬 Complex Query Engine
- Ask questions like:
  - _"Which modules handle user authentication?"_
  - _"Trace the data flow from input to database storage."_
  - _"Show me all functions that can throw an exception."_
- Answers include references, explanations, and context

### 🔒 Security & Compliance
- Detects **hardcoded secrets**, **SQL injection risks**, **insecure deserialization**
- Scans for **weak cryptography**, **CORS misconfigurations**, **shell injection**
- Provides **risk scores** and **remediation recommendations**

### 📊 Visual Architecture
- **Interactive module graph** with language-colored nodes
- Nodes show function/class counts (LOC, call relationships)
- Draggable, zoomable canvas with minimap

### 📖 AI-Powered Explanations
- Purpose, key logic, and dependencies for every file
- High-level architecture summary of the entire project
- Generated via Google Gemini with full codebase context

### ⚡ Performance
- **Disk caching** — All AI outputs cached to avoid recomputation
- **Background analysis** — Analyze repos without blocking the UI
- **Mental model persistence** — Saved to disk as JSON

---

## 📁 Project Structure

```
peek/
├── backend/
│   ├── main.py                  # FastAPI server & routes
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # API keys (gitignored)
│   ├── services/
│   │   ├── repo.py              # Git cloning service
│   │   ├── scanner.py           # File discovery service
│   │   ├── ai.py                # Gemini AI integration
│   │   ├── mental_model.py      # In-memory graph engine
│   │   ├── code_indexer.py      # AST-based code parser
│   │   └── security_analyzer.py # Static security analysis
│   └── utils/
│       └── file_utils.py        # File I/O & hashing utilities
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router
│   │   ├── api.js               # Backend API client
│   │   ├── index.css            # Global styles & theme
│   │   ├── pages/
│   │   │   ├── HomePage.jsx     # Landing page with feature showcase
│   │   │   └── RepoPage.jsx     # 3-panel analysis view + tabs
│   │   └── components/
│   │       ├── FileTree.jsx          # Hierarchical file browser
│   │       ├── ExplanationPanel.jsx  # AI file explanation viewer
│   │       ├── MentalModelPanel.jsx  # ReactFlow architecture graph
│   │       ├── InsightsPanel.jsx     # Security & code smells
│   │       ├── ChatPanel.jsx         # Query engine chat
│   │       └── RepoSummary.jsx       # Architecture overview
│   └── vite.config.js           # Vite + Tailwind config
└── data/                        # Auto-created at runtime
    ├── repos/                   # Cloned repositories
    ├── summaries/               # Per-file AI explanations (cached)
    ├── repo_summaries/          # Architecture summaries (cached)
    └── mental_models/           # Mental model graphs (cached)
```

---

## 🔌 API Endpoints

| Method | Endpoint                        | Description                           |
|--------|---------------------------------|---------------------------------------|
| POST   | `/clone`                        | Clone a GitHub repo                   |
| GET    | `/repo/{id}/files`              | List all code files                   |
| GET    | `/repo/{id}/file-summary`       | Get AI explanation for a file         |
| POST   | `/repo/{id}/analyze`            | Trigger full analysis (background)    |
| GET    | `/repo/{id}/status`             | Get analysis progress                 |
| GET    | `/repo/{id}/summary`            | Get architecture summary              |
| POST   | `/ask`                          | Ask a question about the codebase     |
| GET    | `/repo/{id}/mental-model`       | Get ReactFlow graph data              |
| GET    | `/repo/{id}/mental-model/summary` | Get mental model statistics         |
| GET    | `/repo/{id}/call-graph`         | Get call graph (optionally filtered)  |
| GET    | `/repo/{id}/dependencies`       | Get dependency tree                   |
| GET    | `/repo/{id}/code-smells`        | Get code smell analysis               |
| GET    | `/repo/{id}/security`           | Get security findings                 |

---

## 🛠️ Tech Stack

| Layer         | Technology                |
|---------------|--------------------------|
| Frontend      | React 19 + Vite          |
| Visualization | ReactFlow (@xyflow/react)|
| Styling       | Tailwind CSS v4          |
| Backend       | Python + FastAPI         |
| AI Engine     | Google Gemini 3 Flash    |
| Code Parsing  | Python AST + Regex       |
| Storage       | Local filesystem (JSON)  |

---

## 📝 License

MIT
