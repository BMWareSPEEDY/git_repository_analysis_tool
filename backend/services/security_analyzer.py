"""
Security Analyzer — Detects insecure patterns and sensitive data flows.

Performs static analysis on source code to identify:
- Hardcoded secrets & credentials
- SQL injection vulnerabilities
- Insecure deserialization
- Dangerous function usage
- Missing input validation patterns
- Insecure HTTP usage
- Weak cryptography
"""

from __future__ import annotations
import re
from pathlib import Path
from dataclasses import dataclass, asdict
from utils.file_utils import get_repo_path, read_file_content


@dataclass
class SecurityFinding:
    """A single security issue found in the codebase."""
    rule_id: str
    severity: str       # "critical", "high", "medium", "low", "info"
    category: str       # "secrets", "injection", "crypto", "auth", "misc"
    title: str
    description: str
    file_path: str
    line_number: int
    code_snippet: str
    recommendation: str


# ─── Detection Rules ──────────────────────────────────────────────────

HARDCODED_SECRET_PATTERNS = [
    # API keys and tokens
    (r"""(?:api[_-]?key|apikey|api[_-]?token)\s*[:=]\s*['\"]([^'\"]{8,})['\"]""",
     "Hardcoded API Key", "Possible API key found in source code."),
    # Passwords
    (r"""(?:password|passwd|pwd|pass)\s*[:=]\s*['\"]([^'\"]{4,})['\"]""",
     "Hardcoded Password", "Password appears to be hardcoded."),
    # Secret keys
    (r"""(?:secret[_-]?key|secretkey|signing[_-]?key)\s*[:=]\s*['\"]([^'\"]{8,})['\"]""",
     "Hardcoded Secret Key", "Secret key found in source code."),
    # AWS keys
    (r"""(?:AKIA[0-9A-Z]{16})""",
     "AWS Access Key", "AWS access key ID detected."),
    # Private keys
    (r"""-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----""",
     "Private Key", "Private key found in source code."),
    # Generic tokens
    (r"""(?:token|auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*['\"]([^'\"]{8,})['\"]""",
     "Hardcoded Token", "Authentication token found in source code."),
]

SQL_INJECTION_PATTERNS = [
    # String formatting in SQL queries
    (r"""(?:execute|cursor\.execute|query|raw)\s*\(\s*(?:f['\"]|['\"].*?%s|['\"].*?\{|['\"].*?\+)""",
     "SQL Injection Risk", "SQL query appears to use string formatting/concatenation."),
    # Direct string concatenation with SQL keywords
    (r"""(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*?\+\s*(?:str\(|request|input|params)""",
     "SQL Injection via Concatenation", "SQL query uses string concatenation with user input."),
]

INSECURE_PATTERNS = [
    # eval/exec
    (r"""\beval\s*\(""",
     "dangerous_function", "Use of eval()", "eval() executes arbitrary code and is a security risk."),
    (r"""\bexec\s*\(""",
     "dangerous_function", "Use of exec()", "exec() executes arbitrary code and is a security risk."),
    # Pickle deserialization
    (r"""pickle\.loads?\s*\(""",
     "insecure_deserialization", "Insecure Deserialization (pickle)", "pickle.load() can execute arbitrary code from untrusted data."),
    (r"""yaml\.load\s*\([^)]*(?!Loader)""",
     "insecure_deserialization", "Insecure YAML Loading", "yaml.load() without SafeLoader can execute arbitrary code."),
    # Insecure HTTP
    (r"""http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)""",
     "insecure_transport", "Insecure HTTP", "Using plain HTTP instead of HTTPS for external communication."),
    # Weak hashing
    (r"""(?:hashlib\.)?(?:md5|sha1)\s*\(""",
     "weak_crypto", "Weak Hash Algorithm", "MD5/SHA1 are cryptographically weak. Use SHA-256 or better."),
    # Debug mode in production
    (r"""(?:DEBUG|debug)\s*[:=]\s*(?:True|true|1)""",
     "misc", "Debug Mode Enabled", "Debug mode should be disabled in production."),
    # CORS wildcard
    (r"""(?:allow_origins|Access-Control-Allow-Origin)\s*[:=]\s*\[?\s*['\"\*]""",
     "auth", "CORS Wildcard", "CORS is configured to allow all origins."),
    # Disabled SSL verification
    (r"""verify\s*=\s*False""",
     "insecure_transport", "SSL Verification Disabled", "SSL certificate verification is disabled."),
    # Hardcoded IP addresses
    (r"""\b(?:0\.0\.0\.0)\b(?!.*(?:localhost|test|dev|example))""",
     "misc", "Binding to 0.0.0.0", "Server bound to all interfaces. Consider restricting to specific IPs."),
    # os.system / subprocess with shell=True
    (r"""(?:os\.system|subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True)""",
     "dangerous_function", "Shell Injection Risk", "Using shell=True or os.system() is vulnerable to shell injection."),
]


# ─── Scanner ──────────────────────────────────────────────────────────

def analyze_file_security(file_path: str, relative_path: str) -> list[SecurityFinding]:
    """
    Scan a single file for security issues.

    Args:
        file_path: Absolute path to the file
        relative_path: Relative path within the repo

    Returns:
        List of SecurityFinding instances
    """
    findings = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return findings

    lines = content.splitlines()

    # Skip binary-looking files
    if "\x00" in content[:1000]:
        return findings

    # Check hardcoded secrets
    for pattern, title, desc in HARDCODED_SECRET_PATTERNS:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            line_no = content[:match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""

            findings.append(SecurityFinding(
                rule_id=f"SEC-SECRETS-{len(findings)+1:03d}",
                severity="critical",
                category="secrets",
                title=title,
                description=desc,
                file_path=relative_path,
                line_number=line_no,
                code_snippet=_redact_secret(snippet),
                recommendation="Move secrets to environment variables or a secure vault. Use .env files (with .gitignore) for local development.",
            ))

    # Check SQL injection
    for pattern, title, desc in SQL_INJECTION_PATTERNS:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            line_no = content[:match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""

            findings.append(SecurityFinding(
                rule_id=f"SEC-SQLI-{len(findings)+1:03d}",
                severity="high",
                category="injection",
                title=title,
                description=desc,
                file_path=relative_path,
                line_number=line_no,
                code_snippet=snippet[:120],
                recommendation="Use parameterized queries or an ORM to prevent SQL injection.",
            ))

    # Check other insecure patterns
    for pattern, category, title, desc in INSECURE_PATTERNS:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            line_no = content[:match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""

            severity = "high" if category in ("dangerous_function", "insecure_deserialization") else "medium"

            findings.append(SecurityFinding(
                rule_id=f"SEC-{category.upper()}-{len(findings)+1:03d}",
                severity=severity,
                category=category,
                title=title,
                description=desc,
                file_path=relative_path,
                line_number=line_no,
                code_snippet=snippet[:120],
                recommendation=_get_recommendation(category),
            ))

    return findings


def analyze_repo_security(repo_id: str, file_paths: list[str]) -> dict:
    """
    Run security analysis on all files in a repo.

    Returns a structured report with findings grouped by severity and category.
    """
    repo_path = get_repo_path(repo_id)
    all_findings: list[SecurityFinding] = []

    for rel_path in file_paths:
        full_path = str(repo_path / rel_path)
        findings = analyze_file_security(full_path, rel_path)
        all_findings.extend(findings)

    # Group by severity
    by_severity = {"critical": [], "high": [], "medium": [], "low": [], "info": []}
    for f in all_findings:
        by_severity.get(f.severity, by_severity["info"]).append(asdict(f))

    # Group by category
    by_category: dict[str, list] = {}
    for f in all_findings:
        if f.category not in by_category:
            by_category[f.category] = []
        by_category[f.category].append(asdict(f))

    # Heuristics for Insights Panel
    # Improved complexity heuristic based on code volume and structure
    test_files = [f for f in file_paths if "test" in f.lower() or "spec" in f.lower() or "mock" in f.lower()]
    test_coverage_est = round((len(test_files) / len(file_paths)) * 100) if file_paths else 0
    
    # Calculate a more realistic complexity score based on control structures and findings
    findings_weight = len(all_findings) * 5
    file_count_weight = min(50, len(file_paths) / 2)
    
    # Try to get data from mental model if available
    from services.mental_model import MentalModel
    model = MentalModel.load(repo_id)
    if model and model.functions:
        avg_func_complexity = sum(f.complexity for f in model.functions.values()) / len(model.functions)
        complexity_score = min(100, round((avg_func_complexity * 8) + (len(model.classes) / 5) + (len(file_paths) / 10)))
    else:
        # Fallback heuristic if mental model not loaded
        complexity_score = min(100, round(findings_weight + file_count_weight))
    
    # Ensure it's not 0 for non-empty repos
    if file_paths and complexity_score < 5:
        complexity_score = 5 + min(15, len(file_paths))

    # Summary
    return {
        "repo_id": repo_id,
        "total_findings": len(all_findings),
        "summary": {
            "critical": len(by_severity["critical"]),
            "high": len(by_severity["high"]),
            "medium": len(by_severity["medium"]),
            "low": len(by_severity["low"]),
            "info": len(by_severity["info"]),
        },
        "by_severity": by_severity,
        "by_category": by_category,
        "files_scanned": len(file_paths),
        "risk_score": _compute_risk_score(all_findings),
        "test_coverage_est": test_coverage_est,
        "complexity_score": complexity_score,
    }


def _redact_secret(line: str) -> str:
    """Partially redact a line that may contain a secret."""
    # Replace long strings of non-whitespace characters
    return re.sub(r'(["\'])([^"\']{4})[^"\']*([^"\']{2})(["\'])', r'\1\2****\3\4', line)


def _get_recommendation(category: str) -> str:
    """Get a generic recommendation based on category."""
    return {
        "dangerous_function": "Avoid eval/exec. Use safer alternatives like ast.literal_eval() or structured parsing.",
        "insecure_deserialization": "Use safe serialization formats (JSON) or configure safe loaders.",
        "insecure_transport": "Use HTTPS for all external communications. Configure SSL/TLS properly.",
        "weak_crypto": "Use SHA-256 or stronger hash algorithms. For passwords, use bcrypt or argon2.",
        "auth": "Restrict CORS origins to specific trusted domains. Implement proper authentication.",
        "misc": "Review and fix according to security best practices.",
    }.get(category, "Review and fix according to security best practices.")


def _compute_risk_score(findings: list[SecurityFinding]) -> float:
    """Compute a 0-100 risk score based on findings."""
    if not findings:
        return 0.0

    weights = {"critical": 25, "high": 15, "medium": 8, "low": 3, "info": 1}
    score = sum(weights.get(f.severity, 1) for f in findings)
    return min(100.0, score)
