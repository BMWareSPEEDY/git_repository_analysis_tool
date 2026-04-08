export function generateTooltipText(nodeData) {
    if (!nodeData) return [];
    
    const { imports, exports, imported_by, isEntryPoint, loc, language } = nodeData;
    let texts = [];
    
    if (isEntryPoint) texts.push("🚪 Entry point logic");
    if (imported_by > 0) texts.push(`Used by ${imported_by} files`);
    if (imports > 0) texts.push(`Depends on ${imports} files`);
    if (exports > 0) texts.push(`Exports ${exports} items`);
    if (loc) texts.push(`Core to ${language} system (${loc} LOC)`);
    
    return texts;
}
