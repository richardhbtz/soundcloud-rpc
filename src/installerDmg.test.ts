import { describe, expect, it } from 'vitest';
import { parseMountedImages } from './utils/installerDmg';

const INFO = [
    'framework       : 704',
    'images          : 2',
    '================================================',
    'image-path      : /Users/me/Downloads/soundcloud-0.2.0-mac.dmg',
    'image-type      : read-only disk image',
    '/dev/disk7\tGUID_partition_scheme\t',
    '/dev/disk7s1\tApple_HFS\t/Volumes/SoundCloud 0.2.0',
    '================================================',
    'image-path      : /System/Library/AssetsV2/unmounted.dmg',
    '/dev/disk8\tGUID_partition_scheme\t',
    '',
].join('\n');

describe('parseMountedImages', () => {
    it('pairs each image with its mount points and drops unmounted ones', () => {
        expect(parseMountedImages(INFO)).toEqual([
            { imagePath: '/Users/me/Downloads/soundcloud-0.2.0-mac.dmg', mountPoints: ['/Volumes/SoundCloud 0.2.0'] },
        ]);
    });
});
