"""
Code Indexer — Deep AST-based code parsing for building Mental Models.

Uses:
- Python's built-in `ast` module for .py files (best-in-class for Python)
- tree-sitter-language-pack for all other languages (JS/TS, Java, Go, Rust, C/C++, etc.)
- Regex patterns as a final fallback if tree-sitter can't load a grammar

Extracts:
- Functions / methods (name, params, decorators, calls, line ranges)
- Classes (name, bases, methods, attributes)
- Imports / dependencies
- Module metadata (LOC, language, docstring)
"""

from __future__ import annotations
import ast
import re
import os
from pathlib import Path
from typing import Optional

from services.mental_model import (
    MentalModel,
    ModuleNode,
    FunctionNode,
    ClassNode,
    DependencyEdge,
)
from utils.file_utils import get_repo_path, read_file_content

# ─── tree-sitter setup ───────────────────────────────────────────────

try:
    from tree_sitter_language_pack import get_parser as _ts_get_parser
    TREESITTER_AVAILABLE = True
except ImportError:
    TREESITTER_AVAILABLE = False

# Languages we can parse with tree-sitter
TREESITTER_LANGUAGES = {
    "javascript", "typescript", "java", "go", "rust",
    "c", "cpp", "ruby", "php", "swift", "kotlin",
    "scala", "dart", "c_sharp",
}

# Map our internal language name → tree-sitter grammar name
_TS_LANG_MAP = {
    "csharp": "c_sharp",
}

def _get_ts_parser(language: str):
    """Get a tree-sitter parser for a given language, or None."""
    if not TREESITTER_AVAILABLE:
        return None
    ts_lang = _TS_LANG_MAP.get(language, language)
    if ts_lang not in TREESITTER_LANGUAGES:
        return None
    try:
        return _ts_get_parser(ts_lang)
    except Exception:
        return None


# ─── Language Detection ───────────────────────────────────────────────

LANG_MAP = {
    ".py": "python",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".cs": "csharp",
    ".swift": "swift",
    ".kt": "kotlin", ".kts": "kotlin",
    ".php": "php",
    ".dart": "dart",
    ".scala": "scala",
    ".lua": "lua",
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".sql": "sql",
    ".r": "r", ".R": "r",
}


def detect_language(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    return LANG_MAP.get(ext, "unknown")


# ─── Python AST Indexer ──────────────────────────────────────────────

def _compute_complexity(node: ast.AST) -> int:
    """Estimate cyclomatic complexity by counting branches."""
    complexity = 1
    for child in ast.walk(node):
        if isinstance(child, (ast.If, ast.While, ast.For, ast.ExceptHandler,
                              ast.With, ast.Assert, ast.comprehension)):
            complexity += 1
        elif isinstance(child, ast.BoolOp):
            complexity += len(child.values) - 1
    return complexity


def _extract_calls(node: ast.AST) -> list[str]:
    """Extract all function call names from an AST node."""
    calls = []
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                calls.append(child.func.id)
            elif isinstance(child.func, ast.Attribute):
                calls.append(child.func.attr)
    return calls


def _get_decorators(node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef) -> list[str]:
    """Extract decorator names."""
    decorators = []
    for dec in node.decorator_list:
        if isinstance(dec, ast.Name):
            decorators.append(dec.id)
        elif isinstance(dec, ast.Attribute):
            decorators.append(dec.attr)
        elif isinstance(dec, ast.Call):
            if isinstance(dec.func, ast.Name):
                decorators.append(dec.func.id)
            elif isinstance(dec.func, ast.Attribute):
                decorators.append(dec.func.attr)
    return decorators


def index_python_file(file_path: str, relative_path: str, model: MentalModel):
    """Parse a Python file using AST and populate the mental model."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            source = f.read()
    except Exception:
        return

    lines = source.splitlines()
    loc = len([l for l in lines if l.strip() and not l.strip().startswith("#")])

    try:
        tree = ast.parse(source, filename=relative_path)
    except SyntaxError:
        model.add_module(ModuleNode(path=relative_path, language="python", loc=loc))
        return

    module_doc = ast.get_docstring(tree) or ""

    imports = []
    internal_imports = []
    external_imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
                external_imports.append(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
                if node.level > 0:
                    internal_imports.append(node.module)
                else:
                    external_imports.append(node.module.split(".")[0])

    model.add_module(ModuleNode(
        path=relative_path,
        language="python",
        docstring=module_doc[:200],
        imports=imports,
        loc=loc,
    ))

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            _process_python_function(node, relative_path, "", model)
        elif isinstance(node, ast.ClassDef):
            _process_python_class(node, relative_path, model)

    for imp in imports:
        model.add_dependency(DependencyEdge(
            source=relative_path,
            target=imp,
            imports=[imp],
            is_external=imp.split(".")[0] not in _get_internal_modules(model),
        ))


def _process_python_function(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
    module: str,
    class_name: str,
    model: MentalModel,
):
    """Extract function/method info from AST node."""
    params = [arg.arg for arg in node.args.args if arg.arg not in ("self", "cls")]

    return_type = ""
    if node.returns:
        try:
            return_type = ast.unparse(node.returns)
        except Exception:
            pass

    docstring = ast.get_docstring(node) or ""
    calls = _extract_calls(node)
    complexity = _compute_complexity(node)

    model.add_function(FunctionNode(
        name=node.name,
        module=module,
        class_name=class_name,
        params=params,
        return_type=return_type,
        docstring=docstring[:200],
        calls=calls,
        decorators=_get_decorators(node),
        is_async=isinstance(node, ast.AsyncFunctionDef),
        line_start=node.lineno,
        line_end=node.end_lineno or node.lineno,
        complexity=complexity,
    ))


def _process_python_class(node: ast.ClassDef, module: str, model: MentalModel):
    """Extract class info from AST node."""
    bases = []
    for base in node.bases:
        if isinstance(base, ast.Name):
            bases.append(base.id)
        elif isinstance(base, ast.Attribute):
            try:
                bases.append(ast.unparse(base))
            except Exception:
                bases.append(base.attr)

    methods = []
    attributes = []
    docstring = ast.get_docstring(node) or ""

    for item in node.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            methods.append(item.name)
            _process_python_function(item, module, node.name, model)
        elif isinstance(item, ast.Assign):
            for target in item.targets:
                if isinstance(target, ast.Name):
                    attributes.append(target.id)

    model.add_class(ClassNode(
        name=node.name,
        module=module,
        bases=bases,
        methods=methods,
        attributes=attributes,
        docstring=docstring[:200],
        decorators=_get_decorators(node),
        line_start=node.lineno,
        line_end=node.end_lineno or node.lineno,
    ))


def _get_internal_modules(model: MentalModel) -> set[str]:
    """Get set of module names that are part of the repo."""
    internal = set()
    for path in model.modules:
        parts = Path(path).with_suffix("").parts
        for i in range(len(parts)):
            internal.add(".".join(parts[i:]))
    return internal


# ─── tree-sitter Deep Indexer ─────────────────────────────────────────

# Node types that represent functions across languages
_FUNCTION_NODE_TYPES = {
    "function_declaration", "function_definition", "method_definition",
    "method_declaration", "arrow_function", "function_expression",
    "function_item",           # Rust
    "function_literal",
    "constructor_declaration",
}

# Node types that represent classes across languages
_CLASS_NODE_TYPES = {
    "class_declaration", "class_definition",
    "struct_item",             # Rust
    "interface_declaration",
    "type_declaration",        # Go struct via type_declaration → type_spec → struct_type
    "enum_declaration",
}

# Node types that represent imports across languages
_IMPORT_NODE_TYPES = {
    "import_statement", "import_declaration",
    "use_declaration",         # Rust
    "import_from_statement",
    "require_call",
}


def _find_child_by_type(node, *types) -> Optional[object]:
    """Find first direct child matching one of the given types."""
    for child in node.children:
        if child.type in types:
            return child
    return None


def _find_children_by_type(node, *types) -> list:
    """Find all direct children matching one of the given types."""
    return [c for c in node.children if c.type in types]


def _node_text(node) -> str:
    """Get text content of a tree-sitter node as a string."""
    if node is None:
        return ""
    return node.text.decode("utf-8", errors="ignore")


def _extract_ts_identifier(node) -> str:
    """Extract the identifier (name) from a definition node."""
    ident = _find_child_by_type(node, "identifier", "property_identifier", "name", "type_identifier")
    if ident:
        return _node_text(ident)
    return ""


def _extract_ts_params(node) -> list[str]:
    """Extract parameter names from a parameter list node."""
    params_node = _find_child_by_type(
        node,
        "formal_parameters", "parameter_list", "parameters",
        "function_params", "formal_parameter_list",
    )
    if not params_node:
        return []

    params = []
    for child in params_node.children:
        if child.type in ("identifier", "simple_parameter", "required_parameter",
                          "optional_parameter", "rest_parameter", "parameter_declaration"):
            ident = _find_child_by_type(child, "identifier")
            if ident:
                params.append(_node_text(ident))
            elif child.type == "identifier":
                params.append(_node_text(child))
    return params


def _extract_ts_calls(node) -> list[str]:
    """Walk a node tree and extract function call names."""
    calls = []
    queue = [node]
    while queue:
        n = queue.pop()
        if n.type == "call_expression":
            func_node = n.children[0] if n.children else None
            if func_node:
                if func_node.type == "identifier":
                    calls.append(_node_text(func_node))
                elif func_node.type in ("member_expression", "field_expression"):
                    prop = _find_child_by_type(func_node, "property_identifier", "field_identifier", "identifier")
                    if prop:
                        calls.append(_node_text(prop))
        for child in n.children:
            queue.append(child)
    return calls


def _extract_ts_bases(node) -> list[str]:
    """Extract base/parent class names from a class declaration."""
    bases = []
    # Java/TS: superclass node
    for sup in _find_children_by_type(node, "superclass", "extends_clause", "class_heritage"):
        for child in sup.children:
            if child.type in ("identifier", "type_identifier", "generic_type"):
                ident = _find_child_by_type(child, "identifier", "type_identifier")
                bases.append(_node_text(ident or child))
    return bases


def _estimate_complexity_ts(node) -> int:
    """Estimate cyclomatic complexity by counting branch nodes in tree-sitter AST."""
    complexity = 1
    branch_types = {
        "if_statement", "else_clause", "while_statement", "for_statement",
        "for_in_statement", "switch_case", "catch_clause", "ternary_expression",
        "conditional_expression", "match_arm",
    }
    queue = [node]
    while queue:
        n = queue.pop()
        if n.type in branch_types:
            complexity += 1
        for c in n.children:
            queue.append(c)
    return complexity


def index_treesitter_file(file_path: str, relative_path: str, language: str, model: MentalModel):
    """
    Parse a non-Python file using tree-sitter for deep AST analysis.
    Extracts functions, classes, imports, and call relationships with
    accurate line ranges — far more reliable than regex.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            source = f.read()
    except Exception:
        return

    source_bytes = source.encode("utf-8")
    parser = _get_ts_parser(language)
    if parser is None:
        # Fallback to regex if tree-sitter unavailable for this language
        index_generic_file(file_path, relative_path, language, model)
        return

    tree = parser.parse(source_bytes)
    root = tree.root_node

    lines = source.splitlines()
    loc = len([l for l in lines if l.strip()])

    imports = []
    functions_found = []
    classes_found = []

    # Walk the entire tree to collect entities
    queue = [(root, "")]  # (node, current_class_name)
    while queue:
        node, current_class = queue.pop(0)

        # ── Imports ──
        if node.type in _IMPORT_NODE_TYPES:
            import_text = _node_text(node).strip()
            # Extract the imported module/path
            string_node = _find_child_by_type(node, "string", "string_literal", "interpreted_string_literal")
            if string_node:
                imp = _node_text(string_node).strip("'\"` ")
                imports.append(imp)
            else:
                # For Java/Go-style: import foo.bar.Baz;
                parts = []
                for child in node.children:
                    if child.type in ("identifier", "scoped_identifier", "package_identifier",
                                      "dotted_name", "scoped_use_list"):
                        parts.append(_node_text(child))
                if parts:
                    imports.append(".".join(parts))
            continue  # Don't recurse into import nodes

        # ── Functions ──
        if node.type in _FUNCTION_NODE_TYPES:
            name = _extract_ts_identifier(node)
            if not name:
                # Arrow functions assigned to variables: const foo = () => {}
                # The parent might be a variable_declarator
                name = f"<anonymous:{node.start_point[0]+1}>"

            params = _extract_ts_params(node)
            calls = _extract_ts_calls(node)
            complexity = _estimate_complexity_ts(node)

            is_async = any(
                c.type == "async" or _node_text(c) == "async"
                for c in node.children
                if c.type in ("async", "modifier")
            )

            model.add_function(FunctionNode(
                name=name,
                module=relative_path,
                class_name=current_class,
                params=params,
                calls=calls,
                is_async=is_async,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                complexity=complexity,
            ))
            functions_found.append(name)
            # Don't recurse into functions to avoid double-counting nested
            continue

        # ── Classes ──
        if node.type in _CLASS_NODE_TYPES:
            name = _extract_ts_identifier(node)
            bases = _extract_ts_bases(node)

            # Find methods inside the class body
            methods = []
            body = _find_child_by_type(node, "class_body", "declaration_list",
                                       "block", "field_declaration_list")
            if body:
                for member in body.children:
                    if member.type in _FUNCTION_NODE_TYPES:
                        method_name = _extract_ts_identifier(member)
                        if method_name:
                            methods.append(method_name)
                        # Queue the method to be processed as a function
                        queue.append((member, name))

            model.add_class(ClassNode(
                name=name,
                module=relative_path,
                bases=bases,
                methods=methods,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
            ))
            classes_found.append(name)
            continue  # Already queued class body members

        # Recurse into children
        for child in node.children:
            queue.append((child, current_class))

    # Register the module
    model.add_module(ModuleNode(
        path=relative_path,
        language=language,
        imports=imports,
        loc=loc,
    ))

    # Dependencies
    for imp in imports:
        model.add_dependency(DependencyEdge(
            source=relative_path,
            target=imp,
            imports=[imp],
            is_external=True,  # Refined later in build_mental_model
        ))


# ─── Generic Regex Indexer (final fallback) ───────────────────────────

FUNCTION_PATTERNS = {
    "javascript": [
        r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)",
        r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?([^)]*)\)?\s*=>",
    ],
    "typescript": [
        r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)",
        r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(?([^)]*)\)?\s*=>",
    ],
    "java": [
        r"(?:public|private|protected|static|\s)+(?:[\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{",
    ],
    "go": [
        r"func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)",
    ],
    "rust": [
        r"(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)",
    ],
    "cpp": [
        r"(?:[\w:]+\s+)?(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*\{",
    ],
    "c": [
        r"(?:[\w\*]+\s+)+(\w+)\s*\(([^)]*)\)\s*\{",
    ],
    "ruby": [
        r"def\s+(\w+)(?:\(([^)]*)\))?",
    ],
    "php": [
        r"(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(([^)]*)\)",
    ],
}

CLASS_PATTERNS = {
    "javascript": [r"class\s+(\w+)(?:\s+extends\s+([\w.]+))?"],
    "typescript": [r"(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([\w.,\s]+))?"],
    "java": [r"(?:public|private|protected|abstract|\s)*class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([\w.,\s]+))?"],
    "go": [r"type\s+(\w+)\s+struct\s*\{"],
    "rust": [r"(?:pub\s+)?struct\s+(\w+)(?:<[^>]*>)?"],
    "cpp": [r"class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+([\w:]+))?"],
    "ruby": [r"class\s+(\w+)(?:\s*<\s*([\w:]+))?"],
    "php": [r"class\s+(\w+)(?:\s+extends\s+([\w\\]+))?(?:\s+implements\s+([\w\\,\s]+))?"],
}

IMPORT_PATTERNS = {
    "javascript": [
        r"import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]",
        r"require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)",
    ],
    "typescript": [r"import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]"],
    "java": [r"import\s+([\w.]+);"],
    "go": [r"\"([\w./]+)\""],
    "rust": [r"use\s+([\w:]+)"],
    "ruby": [r"require\s+['\"]([^'\"]+)['\"]"],
    "php": [r"use\s+([\w\\]+)"],
}


def index_generic_file(file_path: str, relative_path: str, language: str, model: MentalModel):
    """Regex-based fallback parser for when tree-sitter is unavailable."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            source = f.read()
    except Exception:
        return

    lines = source.splitlines()
    loc = len([l for l in lines if l.strip()])

    imports = []
    for pattern in IMPORT_PATTERNS.get(language, []):
        for match in re.finditer(pattern, source):
            imports.append(match.group(1))

    model.add_module(ModuleNode(
        path=relative_path, language=language, imports=imports, loc=loc,
    ))

    for pattern in FUNCTION_PATTERNS.get(language, []):
        for match in re.finditer(pattern, source):
            name = match.group(1)
            params_str = match.group(2) if match.lastindex >= 2 else ""
            params = [p.strip().split()[-1].strip(",") for p in params_str.split(",") if p.strip()] if params_str else []
            line_no = source[:match.start()].count("\n") + 1
            model.add_function(FunctionNode(
                name=name, module=relative_path, params=params,
                line_start=line_no, line_end=line_no,
            ))

    for pattern in CLASS_PATTERNS.get(language, []):
        for match in re.finditer(pattern, source):
            name = match.group(1)
            bases = []
            if match.lastindex and match.lastindex >= 2 and match.group(2):
                bases = [b.strip() for b in match.group(2).split(",")]
            line_no = source[:match.start()].count("\n") + 1
            model.add_class(ClassNode(
                name=name, module=relative_path, bases=bases,
                line_start=line_no, line_end=line_no,
            ))

    for imp in imports:
        model.add_dependency(DependencyEdge(
            source=relative_path, target=imp, imports=[imp], is_external=True,
        ))


# ─── Main Indexing Entry Point ────────────────────────────────────────

def build_mental_model(repo_id: str, file_paths: list[str]) -> MentalModel:
    """
    Build a complete mental model by indexing all files in the repo.

    Parsing priority:
    1. Python files → ast module (best for Python)
    2. Supported languages → tree-sitter (deep AST)
    3. Other known languages → regex fallback
    4. Unknown → register module only
    """
    repo_path = get_repo_path(repo_id)
    model = MentalModel(repo_id)

    ts_parsed = 0
    regex_parsed = 0

    for rel_path in file_paths:
        full_path = str(repo_path / rel_path)
        language = detect_language(rel_path)

        if language == "python":
            index_python_file(full_path, rel_path, model)
        elif language != "unknown":
            # Try tree-sitter first, then regex fallback
            parser = _get_ts_parser(language)
            if parser is not None:
                index_treesitter_file(full_path, rel_path, language, model)
                ts_parsed += 1
            else:
                index_generic_file(full_path, rel_path, language, model)
                regex_parsed += 1
        else:
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    loc = len(f.readlines())
            except Exception:
                loc = 0
            model.add_module(ModuleNode(path=rel_path, language="unknown", loc=loc))

    # Build the call graph from collected data
    model.build_call_graph()

    # Refine dependency classification
    internal_modules = _get_internal_modules(model)
    for dep in model.dependencies:
        dep.is_external = dep.target.split(".")[0] not in internal_modules

    # Store parsing stats in metadata
    model.metadata["parser_stats"] = {
        "python_ast": sum(1 for m in model.modules.values() if m.language == "python"),
        "treesitter": ts_parsed,
        "regex_fallback": regex_parsed,
        "unknown": sum(1 for m in model.modules.values() if m.language == "unknown"),
    }

    # Save to disk
    model.save()

    return model
