export interface ParsedTrackInfo {
    artist: string | null;
    track: string;
}

export function parseSoundCloudTitle(title: string): ParsedTrackInfo {
    if (!title || typeof title !== 'string') {
        return { artist: null, track: '' };
    }

    const cleanTitle = title
        .replace(/\n.*/, '')
        .trim();

    // Define dash separators (hyphen, en dash, em dash, horizontal bar)
    const dashSeparators = [
        ' - ', // hyphen with spaces
        ' \u2013 ', // en dash with spaces
        ' \u2014 ', // em dash with spaces
        ' \u2015 ', // horizontal bar with spaces
        '-', // hyphen without spaces (fallback)
        '\u2013', // en dash without spaces (fallback)
        '\u2014', // em dash without spaces (fallback)
        '\u2015' // horizontal bar without spaces (fallback)
    ];

    // Try to find a separator and split
    for (const separator of dashSeparators) {
        const index = cleanTitle.indexOf(separator);
        if (index > 0) {
            const potentialArtist = cleanTitle.substring(0, index).trim();
            const potentialTrack = cleanTitle.substring(index + separator.length).trim();
            
            // Only split if both parts are meaningful (not empty and not too short)
            if (potentialArtist.length > 0 && potentialTrack.length > 0) {
                return {
                    artist: potentialArtist,
                    track: potentialTrack
                };
            }
        }
    }

    // If no separator found or splitting didn't work, use the whole title as track
    return {
        artist: null,
        track: cleanTitle
    };
}

export function normalizeTrackInfo(
    titleFromPage: string,
    authorFromPage: string,
    useParsedTitle: boolean = true
): { artist: string; track: string } {
    if (!useParsedTitle || !titleFromPage) {
        // Fallback to original behavior
        return {
            artist: authorFromPage || 'Unknown Artist',
            track: titleFromPage
                .replace(/.*?:\s*/, '')
                .replace(/\n.*/, '')
                .trim() || 'Unknown Track'
        };
    }

    const parsed = parseSoundCloudTitle(titleFromPage);
    
    return {
        artist: parsed.artist || authorFromPage || 'Unknown Artist',
        track: parsed.track || 'Unknown Track'
    };
}
