# PEEK — Program Exploration & Examination Kit

**PEEK** is an AI-powered platform that builds a **mental model** of any codebase automatically. Instead of just indexing files and functions, it understands the architecture, dependencies, call graphs, security patterns, and overall behavior. The goal is to turn messy or poorly documented code into something both developers and AI tools can actually understand and work with.

**Powered by Google Gemini 3 Flash** · **100% Local-First** · **No Database Required** · **ReactFlow Visualizations**

---

## Setup

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Git**
- **Google Gemini API Key** → https://aistudio.google.com/apikey

---

### 1. Backend Setup

```bash
cd backend

echo "GEMINI_API_KEY=your_key_here" > .env
pip install -r requirements.txt
python main.py
```

The backend runs on **http://localhost:8000**.

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:5173**.

---

### 3. How to Use

1. Open **http://localhost:5173**
2. Paste a public GitHub repository URL
3. Click **"Analyze"**
4. Explore:
   - **Code View** — File-by-file AI explanations  
   - **Mental Model** — Interactive architecture graph  
   - **Insights** — Security issues and code smells  
   - **Query Engine** — Ask questions in natural language  

---

## Key Features

### Automated Code Indexing & Mental Model
- Supports **30+ languages** using Python parsing + regex fallback  
- Builds **call graphs**, **class hierarchies**, and **dependency trees**  
- Detects **code smells** and structural issues  
- Fully visualized using **ReactFlow**

---

### Query Engine
Ask things like:
- "Which modules handle user authentication?"  
- "Trace the data flow from input to database."  
- "Which functions can throw exceptions?"  

Responses include context, references, and explanations.

---

### Security & Compliance
- Detects **hardcoded secrets**, **SQL injection risks**, and unsafe patterns  
- Flags issues like **insecure deserialization**, **weak cryptography**, and **CORS misconfigurations**  
- Provides **risk scores** and suggestions to fix them  

---

### Visual Architecture
- Interactive graph of the entire codebase  
- Language-based node coloring  
- Displays function/class counts and relationships  
- Zoomable and draggable with minimap support  

---

### AI-Powered Explanations
- Explains the purpose and logic of each file  
- Generates a high-level overview of the entire project  
- Uses full codebase context via Gemini  

---

### Performance
- **Disk caching** avoids recomputing AI outputs  
- **Background processing** keeps the UI responsive  
- **Mental model persistence** saved as JSON  

---

## Tech Stack

| Layer         | Technology                |
|--------------|--------------------------|
| Frontend     | React 19 + Vite          |
| Visualization| ReactFlow (@xyflow/react)|
| Styling      | Tailwind CSS v4          |
| Backend      | Python + FastAPI         |
| AI Engine    | Google Gemini 3 Flash    |
| Parsing      | Python AST + Regex       |
| Storage      | Local filesystem (JSON)  |

---

## Demo Video
https://vimeo.com/1186625702?share=copy&fl=sv&fe=ci#t=0

---

## AI Usage

To be transparent, I did use AI while building this project.

Most of it was for the frontend, since I’m more comfortable with backend development and still learning React and TypeScript. That said, working on this actually helped me improve a lot—not just with UI, but also with integrating frontend and backend properly.

I also used AI for a small experiment. There’s a shell script in the project that’s fully AI-generated. It launches both the frontend and backend together and opens the app in the browser. It made testing much faster, especially after restarting my IDE or taking breaks.

---

## License

MIT
