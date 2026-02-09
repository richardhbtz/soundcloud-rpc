export interface FileMetadata {
    name: string;
    author: string;
    version: string;
    description: string;
    license: string;
    homepage: string;
    [key: string]: string;
}

const DEFAULTS: FileMetadata = {
    name: '',
    author: 'Unknown',
    version: '0.0.0',
    description: '',
    license: '',
    homepage: '',
};

function extractBlock(source: string, style: 'css' | 'js'): string | null {
    if (style === 'js') {
        const m = source.match(/^[\s\S]*?\/\*\*([\s\S]*?)\*\//);
        return m ? m[1] : null;
    }
    const m = source.match(/^[\s\S]*?\/\*([\s\S]*?)\*\//);
    return m ? m[1] : null;
}

function parseFields(block: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = block.split('\n');
    for (const line of lines) {
        const cleaned = line.replace(/^\s*\*?\s*/, '').trim();
        const match = cleaned.match(/^@(\w+)\s+(.*)/);
        if (match) {
            fields[match[1].toLowerCase()] = match[2].trim();
        }
    }
    return fields;
}

export function parseMetadata(source: string, style: 'css' | 'js'): FileMetadata {
    const block = extractBlock(source, style);
    if (!block) return { ...DEFAULTS };
    const fields = parseFields(block);
    return { ...DEFAULTS, ...fields };
}
