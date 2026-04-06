/**
 * API client for the AI Codebase Explainer backend.
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
 * Trigger full analysis (file explanations + repo summary).
 * @param {string} repoId
 */
export async function analyzeRepo(repoId) {
  return request(`/repo/${repoId}/analyze`, { method: 'POST' });
}

/**
 * Get analysis status/progress.
 * @param {string} repoId
 * @returns {{ status: string, total_files: number, files_processed: number, current_file: string }}
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
 * Ask a question about the codebase.
 * @param {string} repoId
 * @param {string} question
 * @returns {{ answer: string }}
 */
export async function askQuestion(repoId, question) {
  return request('/ask', {
    method: 'POST',
    body: JSON.stringify({ repo_id: repoId, question }),
  });
}
