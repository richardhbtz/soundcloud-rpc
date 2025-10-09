import type { ParsedTrackInfo, NormalizedTrackInfo } from '../types';

// Characters: - (hyphen U+002D), – (en dash U+2013), — (em dash U+2014), ― (horizontal bar U+2015)
const SEPARATOR_REGEX = /(\s+[\u002D\u2013\u2014\u2015]\s+|[\u002D\u2013\u2014\u2015])/;

export function parseSoundCloudTitle(title: string): ParsedTrackInfo {
    if (!title || typeof title !== 'string') {
        return { artist: null, track: '' };
    }

    const cleanTitle = title.replace(/\n.*/, '').trim();

    const match = cleanTitle.match(SEPARATOR_REGEX);
    if (match && match.index && match.index > 0) {
        const potentialArtist = cleanTitle.substring(0, match.index).trim();
        const potentialTrack = cleanTitle.substring(match.index + match[0].length).trim();

        if (potentialArtist.length > 0 && potentialTrack.length > 0) {
            return {
                artist: potentialArtist,
                track: potentialTrack,
            };
        }
    }

    // If no separator found or splitting didn't work, use the whole title as track
    return {
        artist: null,
        track: cleanTitle,
    };
}

export function normalizeTrackInfo(
    titleFromPage: string,
    authorFromPage: string,
    useTrackParser: boolean = true,
): NormalizedTrackInfo {
    if (!useTrackParser || !titleFromPage) {
        // Fallback to original behavior
        return {
            artist: authorFromPage || 'Unknown Artist',
            track: titleFromPage.replace(/\n.*/, '').trim() || 'Unknown Track',
        };
    }

    const parsed = parseSoundCloudTitle(titleFromPage);

    return {
        artist: parsed.artist || authorFromPage || 'Unknown Artist',
        track: parsed.track || 'Unknown Track',
    };
}

// Test function to validate regex parsing
/*
function testTrackParser() {
    const testCases = [
        "Artist Name - Song Title",
        "Artist Name-Song Title",
        "Artist Name — Song Title",  // em dash with spaces
        "Artist Name—Song Title",    // em dash without spaces
        "Artist Name – Song Title",  // en dash with spaces
        "Artist Name–Song Title",    // en dash without spaces
        "Artist Name ― Song Title",  // horizontal bar with spaces
        "Artist Name―Song Title",    // horizontal bar without spaces
        "Just a Song Title",         // no separator
        "- No Artist",               // separator at start
        "No Song -",                 // separator at end
        "Multiple - Dashes - Here",  // multiple separators
        "",                          // empty string
        "Artist\nWith\nNewlines - Song Title"  // with newlines
    ];

    console.log("=== Track Parser Test Results ===");
    testCases.forEach((testCase, index) => {
        const result = parseSoundCloudTitle(testCase);
        console.log(`${index + 1}. "${testCase}"`);
        console.log(`   -> Artist: "${result.artist}", Track: "${result.track}"`);
        console.log("");
    });
}

testTrackParser();
*/
