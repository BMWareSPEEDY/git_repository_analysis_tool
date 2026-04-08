export function generateMermaidText(nodes, edges) {
    let mermaidText = "%%{init: {'theme': 'dark', 'flowchart': {'curve': 'stepAfter', 'nodeSep': 80, 'rankSep': 120}}}%%\nflowchart LR\n";

    const validNodes = nodes.filter(n => n.type !== 'group');
    const validEdges = edges.filter(e => e.source && e.target);

    validNodes.forEach(node => {
        const id = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
        let label = (node.data?.label || id).replace(/['"\[\]\(\)]/g, ''); 

        if (node.data?.category === 'frontend') {
             mermaidText += `    ${id}["${label}"]:::frontend\n`;
        } else if (node.data?.category === 'backend') {
            mermaidText += `    ${id}["${label}"]:::backend\n`;
        } else {
            mermaidText += `    ${id}["${label}"]\n`;
        }
    });

    validEdges.forEach(edge => {
        const source = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
        const target = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
        mermaidText += `    ${source} --> ${target}\n`;
    });

    mermaidText += "\n    classDef frontend fill:#3b82f6,color:#fff,stroke:#fff;"
    mermaidText += "\n    classDef backend fill:#10b981,color:#fff,stroke:#fff;"

    return mermaidText;
}
