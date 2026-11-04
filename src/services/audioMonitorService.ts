export const audioMonitorScript = `
(function() {
  // Avoid duplicate injections
  if (window.__soundCloudMonitorActive) return;
  window.__soundCloudMonitorActive = true;
  
  console.debug('monitor script injected');
  
  // Track current playback state
  let isCurrentlyPlaying = false;
  let currentTrackTitle = '';
  let currentTrackAuthor = '';
  let currentTrackUrl = '';
  let currentTrackElapsed = '';
  let currentTrackDuration = '';
  let isCurrentTrackLiked = false;
  let elapsedObserver = null;
  
  // SoundCloud has renamed player selectors before; keep a fallback chain so a
  // redesign degrades to a logged miss instead of a dead like button.
  function getLikeButton() {
    return document.querySelector('.playbackSoundBadge__like') ||
           document.querySelector('.playbackSoundBadge .sc-button-like') ||
           document.querySelector('.sc-button-like');
  }
  
  function getTrackInfo() {
    const playButton = document.querySelector('.playControls__play');
    const isPlaying = playButton ? playButton.classList.contains('playing') : false;
    
    const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
    const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
    const elapsedEl = document.querySelector('.playbackTimeline__timePassed span:last-child');
    const durationEl = document.querySelector('.playbackTimeline__duration span:last-child');
    const urlEl = document.querySelector('.playbackSoundBadge__titleLink');
    const likeButtonEl = getLikeButton();
    
    return {
      title: artworkEl ? artworkEl.getAttribute('aria-label') : '',
      author: authorEl ? authorEl.textContent.trim() : '',
      artwork: artworkEl ? artworkEl.style.backgroundImage.replace(/^url\\(['"]?|['"]?\\)$/g, '') : '',
      elapsed: elapsedEl ? elapsedEl.textContent.trim() : '',
      duration: durationEl ? durationEl.textContent.trim() : '',
      isPlaying: isPlaying,
      isLiked: likeButtonEl ? likeButtonEl.classList.contains('sc-button-selected') : false,
      url: urlEl ? urlEl.href.split('?')[0] : ''
    };
  }

  function notifyPlaybackStateChange() {
    const trackInfo = getTrackInfo();
    const stateChanged = trackInfo.isPlaying !== isCurrentlyPlaying;
    const trackChanged = 
      trackInfo.title !== currentTrackTitle || 
      trackInfo.author !== currentTrackAuthor ||
      trackInfo.url !== currentTrackUrl;
    const elapsedChanged = trackInfo.elapsed !== currentTrackElapsed;
    const durationChanged = trackInfo.duration !== currentTrackDuration;
    const likeChanged = trackInfo.isLiked !== isCurrentTrackLiked;
    
    if (stateChanged || trackChanged || elapsedChanged || likeChanged || !window.__initialStateSent) {
      isCurrentlyPlaying = trackInfo.isPlaying;
      currentTrackTitle = trackInfo.title;
      currentTrackAuthor = trackInfo.author;
      currentTrackUrl = trackInfo.url;
      currentTrackElapsed = trackInfo.elapsed;
      currentTrackDuration = trackInfo.duration;
      isCurrentTrackLiked = trackInfo.isLiked;
      window.__initialStateSent = true;
      
      window.soundcloudAPI.sendTrackUpdate(trackInfo, 'playback-state-change');
      console.debug('Playbook state change:', trackInfo.isPlaying ? 'playing' : 'paused', trackInfo);
    }
  }
  
  // Monitor play button state changes directly
  function setupPlaybackObserver() {
    const playButton = document.querySelector('.playControls__play');
    if (!playButton) return false;
    
    const observer = new MutationObserver(() => {
      notifyPlaybackStateChange();
    });
    
    observer.observe(playButton, { 
      attributes: true,
      attributeFilter: ['class'] // class changes indicate play/pause. can also do title and label
    });
    
    return true;
  }
  
  // Monitor playback controls for direct clicks
  function monitorPlaybackControls() {
    const playPauseButton = document.querySelector('.playControl');
    if (playPauseButton && !playPauseButton.__monitored) {
      playPauseButton.__monitored = true;
      playPauseButton.addEventListener('click', () => {
        console.debug('Play/pause button');
        // Small delay to allow the class to update
        setTimeout(notifyPlaybackStateChange, 50);
      });
    }
    
    // Monitor prev/next buttons too as they affect playback
    const prevButton = document.querySelector('.skipControl__previous');
    const nextButton = document.querySelector('.skipControl__next');
    
    if (prevButton && !prevButton.__monitored) {
      prevButton.__monitored = true;
      prevButton.addEventListener('click', () => {
        console.debug('Previous track button clicked');
        currentTrackTitle = '';
        currentTrackAuthor = '';
        currentTrackUrl = '';
        // Wait a bit longer for track to change
        setTimeout(notifyPlaybackStateChange, 300);
      });
    }
    
    if (nextButton && !nextButton.__monitored) {
      nextButton.__monitored = true;
      nextButton.addEventListener('click', () => {
        console.debug('Next track button clicked');
        currentTrackTitle = '';
        currentTrackAuthor = '';
        currentTrackUrl = '';
        // Wait a bit longer for track to change
        setTimeout(notifyPlaybackStateChange, 300);
      });
    }

    // Monitor like button interaction to instantly trigger UI mirror
    monitorLikeButton();

    monitorTimelineSeeking();
    monitorWaveformSeeking();
  }

  // The like class flips when SoundCloud's API confirms the change, so watch the
  // class instead of guessing a delay: works while paused, and survives slow or
  // failed API responses (the revert also fires the observer).
  function monitorLikeButton() {
    const likeButton = getLikeButton();
    if (!likeButton) return false;
    if (likeButton.__likeMonitored) return true;
    likeButton.__likeMonitored = true;

    likeButton.addEventListener('click', () => {
      console.debug('Like button clicked');
      // Fallbacks for builds where the class lags behind the API response.
      setTimeout(notifyPlaybackStateChange, 300);
      setTimeout(notifyPlaybackStateChange, 1000);
    });

    new MutationObserver(() => {
      console.debug('Like state changed');
      notifyPlaybackStateChange();
    }).observe(likeButton, { attributes: true, attributeFilter: ['class'] });

    return true;
  }

  function monitorWaveformSeeking() {
    const waveformWrapper = document.querySelector('.waveform');
    
    if (waveformWrapper && !waveformWrapper.__waveformMonitored) {
      waveformWrapper.__waveformMonitored = true;
      
      waveformWrapper.addEventListener('click', () => {
        setTimeout(() => {
          const trackInfo = getTrackInfo();
          currentTrackElapsed = trackInfo.elapsed;
          window.soundcloudAPI.sendTrackUpdate(trackInfo, 'waveform-seek');
        }, 100);
      });
      console.debug('Waveform click monitoring attached');
    }
    
    return !!waveformWrapper;
  }

  function monitorTimelineSeeking() {
    const timelineElement = document.querySelector('.playbackTimeline.is-scrubbable.has-sound');
    
    if (timelineElement && !timelineElement.__seekMonitored) {
      timelineElement.__seekMonitored = true;
      
      const timelineObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'class') {
            const isDragging = timelineElement.classList.contains('is-dragging');
            
            if (!isDragging && timelineElement.__wasDragging) {
              // Dragging ended - update the presence with new position
              console.debug('Seek completed - updating time position');
              setTimeout(() => {
                const trackInfo = getTrackInfo();
                currentTrackElapsed = trackInfo.elapsed;
                window.soundcloudAPI.sendTrackUpdate(trackInfo, 'timeline-seek');
              }, 50);
            }
            
            timelineElement.__wasDragging = isDragging;
          }
        }
      });
      
      timelineObserver.observe(timelineElement, {
        attributes: true,
        attributeFilter: ['class']
      });
      console.debug('Timeline seek monitoring attached');
    }
    
    return !!timelineElement;
  }
  
  // Monitor elapsed time element for changes (catches loops)
  function monitorElapsedTime() {
    const elapsedElement = document.querySelector('.playbackTimeline__timePassed span:last-child');
    
    if (elapsedElement) {
      if (elapsedObserver) {
        elapsedObserver.disconnect();
      }
      
      elapsedObserver = new MutationObserver(() => {
        const trackInfo = getTrackInfo();
        
        // Only update if one of these have changed:
        // 1. Track changed (title/author/url)
        // 2. Play state changed
        // 3. Elapsed time reset to start (loop detection)
        // 4. Like state changed
        const trackChanged = trackInfo.title !== currentTrackTitle ||
                            trackInfo.author !== currentTrackAuthor ||
                            trackInfo.url !== currentTrackUrl;
        const playStateChanged = trackInfo.isPlaying !== isCurrentlyPlaying;
        const likeChanged = trackInfo.isLiked !== isCurrentTrackLiked;
        
        // Check if it's near the start (0-3 seconds = loop)
        const parseTimeToSeconds = (time) => {
          if (!time) return 0;
          const parts = time.split(':').map(p => parseInt(p) || 0);
          let seconds = 0;
          for (const part of parts) {
            seconds = seconds * 60 + part;
          }
          return seconds;
        };
        const elapsedSeconds = parseTimeToSeconds(trackInfo.elapsed);
        const isLoop = elapsedSeconds <= 3;
        
        if (trackChanged || playStateChanged || likeChanged || isLoop) {
          notifyPlaybackStateChange();
        }
      });
      
      // Watch for text content changes
      const parentEl = elapsedElement.parentElement;
      if (parentEl) {
        elapsedObserver.observe(parentEl, {
          childList: true,
          characterData: true,
          subtree: true
        });
        console.debug('Monitoring elapsed time parent element');
      } else {
        elapsedObserver.observe(elapsedElement, {
          childList: true,
          characterData: true,
          subtree: true
        });
        console.debug('Monitoring elapsed time element');
      }
      
      return true;
    }
    return false;
  }
  
  // Initial setup
  function initialize() {
    const playbackObserverSet = setupPlaybackObserver();
    monitorPlaybackControls();
    
    window.__initialStateSent = false;
    notifyPlaybackStateChange();
    
    // Watch for dynamically loaded elements
    if (!playbackObserverSet) {
      const documentObserver = new MutationObserver(() => {
        if (!document.querySelector('.playControls__play')) return;
        
        if (setupPlaybackObserver()) {
          monitorPlaybackControls();
          documentObserver.disconnect();
        }
      });
      
      documentObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    // Start monitoring elapsed time for loop detection
    monitorElapsedTime();
    
    // Re-monitor elements if they get replaced/recreated
    const bodyObserver = new MutationObserver(() => {
      const elapsedEl = document.querySelector('.playbackTimeline__timePassed span:last-child');
      if (elapsedEl && !elapsedObserver) {
        monitorElapsedTime();
      }
      
      const waveformEl = document.querySelector('.waveform');
      if (waveformEl && !waveformEl.__waveformMonitored) {
        monitorWaveformSeeking();
      }
      
      const timelineEl = document.querySelector('.playbackTimeline.is-scrubbable.has-sound');
      if (timelineEl && !timelineEl.__seekMonitored) {
        monitorTimelineSeeking();
      }
      
      const prevButton = document.querySelector('.skipControl__previous');
      const nextButton = document.querySelector('.skipControl__next');
      if ((prevButton && !prevButton.__monitored) || (nextButton && !nextButton.__monitored)) {
        monitorPlaybackControls();
      }
      
      const playPauseButton = document.querySelector('.playControl');
      if (playPauseButton && !playPauseButton.__monitored) {
        monitorPlaybackControls();
      }

      const likeButton = getLikeButton();
      if (likeButton && !likeButton.__likeMonitored) {
        monitorLikeButton();
      }
    });
    
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // DataDome answers a like with 403 + a captcha URL. Hand that URL to the main
  // process so the user can solve it in the app's own session; the cookie it
  // sets is what unblocks the next like.
  function watchLikeCaptcha() {
    if (window.__likeCaptchaWatch) return;
    window.__likeCaptchaWatch = true;

    function send(url) {
      try {
        window.soundcloudAPI.captchaRequired(url);
      } catch (e) {
        console.warn('captcha bridge missing', e);
      }
    }

    function extract(text) {
      try {
        const body = JSON.parse(text);
        if (body && typeof body.url === 'string' && body.url.indexOf('captcha-delivery.com') !== -1) return body.url;
      } catch (e) {
        /* not JSON, not a captcha */
      }
      return null;
    }

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('loadend', function () {
        if (this.status !== 403 || String(this.responseURL).indexOf('/track_likes/') === -1) return;
        const url = extract(this.responseText);
        if (url) send(url);
      });
      return originalSend.apply(this, args);
    };

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      return originalFetch.apply(this, args).then((res) => {
        if (res.status === 403) {
          const target = String((args[0] && args[0].url) || args[0]);
          if (target.indexOf('/track_likes/') !== -1) {
            res.clone()
              .text()
              .then((text) => {
                const url = extract(text);
                if (url) send(url);
              })
              .catch(() => {});
          }
        }
        return res;
      });
    };
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (elapsedObserver) {
      elapsedObserver.disconnect();
      elapsedObserver = null;
    }
  });
  
  // Start monitoring
  watchLikeCaptcha();
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initialize();
  } else {
    document.addEventListener('DOMContentLoaded', initialize);
  }
})();
`;
