/**
 * API client for the PEEK backend.
 * Program Exploration & Examination Kit
 *
 * All calls go through the Vite proxy at /api → http://localhost:8000
 */

const BASE_URL = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Clone a GitHub repository.
 * @param {string} repoUrl - The GitHub URL to clone.
 * @returns {{ repo_id: string, status: string }}
 */
export async function cloneRepo(repoUrl) {
  return request('/clone', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

/**
 * Trigger full analysis (file explanations + mental model + repo summary).
 * @param {string} repoId
 */
export async function analyzeRepo(repoId) {
  return request(`/repo/${repoId}/analyze`, { method: 'POST' });
}

/**
 * Get analysis status/progress.
 * @param {string} repoId
 * @returns {{ status: string, total_files: number, files_processed: number, current_file: string, current_phase: string }}
 */
export async function getAnalysisStatus(repoId) {
  return request(`/repo/${repoId}/status`);
}

/**
 * List all code files in a repo.
 * @param {string} repoId
 * @returns {{ files: string[], count: number }}
 */
export async function listFiles(repoId) {
  return request(`/repo/${repoId}/files`);
}

/**
 * Get AI explanation for a specific file.
 * @param {string} repoId
 * @param {string} filePath - Relative path to the file.
 */
export async function getFileSummary(repoId, filePath) {
  return request(`/repo/${repoId}/file-summary?path=${encodeURIComponent(filePath)}`);
}

/**
 * Get the overall repo architecture summary.
 * @param {string} repoId
 */
export async function getRepoSummary(repoId) {
  return request(`/repo/${repoId}/summary`);
}

/**
 * Ask a question about the codebase with real-time streaming tokens.
 * @param {string} repoId
 * @param {string} question
 * @param {string} [conversationId]
 * @param {Function} onChunk - Callback for each stream chunk: ({ type, ...data })
 */
export async function streamAskQuestion(repoId, question, conversationId, onChunk) {
  const body = { repo_id: repoId, question };
  if (conversationId) body.conversation_id = conversationId;

  const response = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let metadataReceived = false;
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    if (!metadataReceived && buffer.includes('\n--SEP--\n')) {
      const parts = buffer.split('\n--SEP--\n');
      try {
        const metadata = JSON.parse(parts[0]);
        metadataReceived = true;
        buffer = parts.slice(1).join('\n--SEP--\n');
        onChunk({ type: 'metadata', ...metadata });
      } catch (e) {
        // Maybe partial metadata, wait for next chunk
      }
    }

    if (metadataReceived && buffer) {
      onChunk({ type: 'text', text: buffer });
      buffer = '';
    }
  }
}

/**
 * Ask a question (Legacy synchronous version).
 */
export async function askQuestion(repoId, question, conversationId) {
  const body = { repo_id: repoId, question };
  if (conversationId) body.conversation_id = conversationId;
  return request('/ask', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── Conversation APIs ──────────────────────────────────────────────

/**
 * List all conversations for a repo.
 * @param {string} repoId
 * @returns {{ conversations: Array }}
 */
export async function getConversations(repoId) {
  return request(`/repo/${repoId}/conversations`);
}

/**
 * Get a conversation with full message history.
 * @param {string} repoId
 * @param {string} convId
 */
export async function getConversation(repoId, convId) {
  return request(`/repo/${repoId}/conversations/${convId}`);
}

// ─── Mental Model APIs ──────────────────────────────────────────────

/**
 * Get the full mental model as a ReactFlow-compatible graph.
 * @param {string} repoId
 * @returns {{ nodes: Array, edges: Array }}
 */
export async function getMentalModel(repoId) {
  return request(`/repo/${repoId}/mental-model`);
}

/**
 * Get the function-level mental model as a ReactFlow-compatible graph.
 * @param {string} repoId
 * @returns {{ nodes: Array, edges: Array }}
 */
export async function getMentalModelFunctions(repoId) {
  return request(`/repo/${repoId}/mental-model/functions`);
}

/**
 * Get impact analysis for a specific file or function.
 * @param {string} repoId
 * @param {string} target - Module path or function qualified name
 */
export async function getImpactAnalysis(repoId, target) {
  return request(`/repo/${repoId}/impact?target=${encodeURIComponent(target)}`);
}

/**
 * Get mental model summary statistics.
 * @param {string} repoId
 */
export async function getMentalModelSummary(repoId) {
  return request(`/repo/${repoId}/mental-model/summary`);
}

/**
 * Get call graph, optionally for a specific function.
 * @param {string} repoId
 * @param {string} [functionName]
 * @param {number} [depth=3]
 */
export async function getCallGraph(repoId, functionName, depth = 3) {
  const params = new URLSearchParams();
  if (functionName) params.set('function', functionName);
  params.set('depth', depth.toString());
  return request(`/repo/${repoId}/call-graph?${params}`);
}

/**
 * Get dependency tree.
 * @param {string} repoId
 * @param {string} [modulePath]
 */
export async function getDependencies(repoId, modulePath) {
  const params = modulePath ? `?module=${encodeURIComponent(modulePath)}` : '';
  return request(`/repo/${repoId}/dependencies${params}`);
}

/**
 * Get code smells and architectural issues.
 * @param {string} repoId
 */
export async function getCodeSmells(repoId) {
  return request(`/repo/${repoId}/code-smells`);
}

/**
 * Get security analysis report.
 * @param {string} repoId
 */
export async function getSecurityReport(repoId) {
  return request(`/repo/${repoId}/security`);
}
