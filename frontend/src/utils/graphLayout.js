import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY } from 'd3-force';

export function applyForceLayout(initialNodes, initialEdges, width = 1200, height = 800) {
    if (!initialNodes || initialNodes.length === 0) return { nodes: [], edges: [] };

    // Deep copy to avoid mutating React states
    const nodes = initialNodes.map(n => ({ ...n }));
    const edges = initialEdges.map(e => ({ ...e }));

    const groupNodes = nodes.filter(n => n.type === 'group');
    const childNodes = nodes.filter(n => n.type !== 'group');

    // Setup for simulation
    const simNodes = childNodes.map(n => ({
        ...n,
        x: n.position?.x || width / 2 + (Math.random() - 0.5) * 100,
        y: n.position?.y || height / 2 + (Math.random() - 0.5) * 100,
        r: n.data?.importance ? Math.min(Math.max(n.data.importance * 3, 30), 100) : 40 
    }));

    const nodeById = new Map(simNodes.map(n => [n.id, n]));

    const simLinks = edges
        .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
        .map(e => ({
            source: e.source,
            target: e.target,
            id: e.id,
            originEdge: e
        }));

    // cluster centers 
    const clusters = {};
    groupNodes.forEach((grp, i) => {
        clusters[grp.id] = {
            x: (i % 3) * 600 + 400,
            y: Math.floor(i / 3) * 600 + 400
        };
    });

    // Run simulation entirely off-screen
    const simulation = forceSimulation(simNodes)
        .force("charge", forceManyBody().strength(-400))
        .force("link", forceLink(simLinks).id(d => d.id).distance(150))
        .force("collide", forceCollide().radius(d => d.r + 20).iterations(2))
        .force("x", forceX().x(d => d.parentId && clusters[d.parentId] ? clusters[d.parentId].x : width / 2).strength(0.15))
        .force("y", forceY().y(d => d.parentId && clusters[d.parentId] ? clusters[d.parentId].y : height / 2).strength(0.15))
        .stop();

    // Fast-forward simulation to stable state
    for (let i = 0; i < 300; ++i) {
        simulation.tick();
    }

    // Apply positions
    const finalNodes = nodes.map(n => {
        if (n.type === 'group') {
            const children = simNodes.filter(cn => cn.parentId === n.id);
            if (children.length > 0) {
                const minX = Math.min(...children.map(c => c.x - 100));
                const minY = Math.min(...children.map(c => c.y - 100));
                const maxX = Math.max(...children.map(c => c.x + 100));
                const maxY = Math.max(...children.map(c => c.y + 100));
                
                return {
                    ...n,
                    position: { x: minX, y: minY },
                    style: { ...n.style, width: (maxX - minX), height: (maxY - minY) }
                };
            }
            return n;
        } else {
            const simNode = nodeById.get(n.id);
            let nextPos = { ...n.position };
            if (simNode) {
                nextPos = { x: simNode.x, y: simNode.y };
            }
            return {
                ...n,
                position: nextPos,
                positionAbsolute: nextPos
            };
        }
    });

    // Make child nodes relative to parents
    const groupById = new Map(finalNodes.filter(n => n.type === 'group').map(n => [n.id, n]));
    finalNodes.forEach(n => {
        if (n.parentId && groupById.has(n.parentId)) {
            const parent = groupById.get(n.parentId);
            n.position = {
                x: n.positionAbsolute.x - parent.position.x,
                y: n.positionAbsolute.y - parent.position.y
            };
        }
        delete n.positionAbsolute;
    });

    return { nodes: finalNodes, edges: initialEdges };
}
