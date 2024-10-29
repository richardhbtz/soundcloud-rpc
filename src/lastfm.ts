
import type { BrowserWindow } from 'electron';

import * as crypto from 'crypto';
import fetch from 'cross-fetch';
import type ElectronStore = require('electron-store');

require('dotenv').config();

const LAST_FM_API_KEY = process.env.LAST_FM_API_KEY;
const LAST_FM_SECRET = process.env.LAST_FM_SECRET;


function authenticateLastFm(mainWindow: BrowserWindow, store: ElectronStore) {
    const authUrl = `https://www.last.fm/api/auth/?api_key=${LAST_FM_API_KEY}&cb=https://soundcloud.com/discover`;
    mainWindow.loadURL(authUrl);

    mainWindow.webContents.on('will-redirect', async (event, url) => {
        const urlParams = new URLSearchParams(url);
        const token = urlParams.get('token');
        if (token) {
            await getLastFmSession(token, store);
            mainWindow.loadURL('https://soundcloud.com/discover');
        }
    });
}

// After the user logs in, retrieve and store the session key
async function getLastFmSession(token: string, store: ElectronStore) {
    const apiSig = generateApiSignature({
        method: 'auth.getSession',
        api_key: LAST_FM_API_KEY,
        token: token,
    });

    const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${LAST_FM_API_KEY}&token=${token}&api_sig=${apiSig}&format=json`
    );
    const data = await response.json();
    if (data.error) {
        console.error(data.message);
        return;
    }
    store.set('lastFmSessionKey', data.session.key); // Store the session key
}

function generateApiSignature(params: { [x: string]: any; method?: string; api_key?: string; token?: string; }) {
    const sortedParams = Object.keys(params).sort().map(key => `${key}${params[key]}`).join('') + LAST_FM_SECRET;
    return crypto.createHash('md5').update(sortedParams).digest('hex');
}

async function scrobbleTrack(trackInfo: { author: string; title: string; }, store: ElectronStore) {
    const sessionKey = store.get('lastFmSessionKey');
    const timestamp = Math.floor(Date.now() / 1000);
    const apiSig = generateApiSignature({
        method: 'track.scrobble',
        api_key: LAST_FM_API_KEY,
        sk: sessionKey,
        artist: trackInfo.author,
        track: trackInfo.title,
        timestamp: timestamp,
    });
    try {
        await fetch(`https://ws.audioscrobbler.com/2.0/`, {
            method: 'POST',
            body: new URLSearchParams({
                method: 'track.scrobble',
                api_key: LAST_FM_API_KEY,
                sk: sessionKey as string,
                artist: trackInfo.author,
                track: trackInfo.title,
                timestamp: timestamp as unknown as string,
                api_sig: apiSig,
                format: 'json',
            }),
        });
    } catch (error) {
        console.error(error);
    }
}

async function updateNowPlaying(trackInfo: { author: any; title: any; }, store: ElectronStore) {
    const sessionKey = store.get('lastFmSessionKey');
    const apiSig = generateApiSignature({
        method: 'track.updateNowPlaying',
        api_key: LAST_FM_API_KEY,
        sk: sessionKey,
        artist: trackInfo.author,
        track: trackInfo.title,
    });

    await fetch(`https://ws.audioscrobbler.com/2.0/`, {
        method: 'POST',
        body: new URLSearchParams({
            method: 'track.updateNowPlaying',
            api_key: LAST_FM_API_KEY,
            sk: sessionKey as string,
            artist: trackInfo.author,
            track: trackInfo.title,
            api_sig: apiSig,
            format: 'json',
        }),
    });
}

export { authenticateLastFm, getLastFmSession, scrobbleTrack, updateNowPlaying };

