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
  let elapsedObserver = null;
  
  function getTrackInfo() {
    const playButton = document.querySelector('.playControls__play');
    const isPlaying = playButton ? playButton.classList.contains('playing') : false;
    
    const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
    const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
    const elapsedEl = document.querySelector('.playbackTimeline__timePassed span:last-child');
    const durationEl = document.querySelector('.playbackTimeline__duration span:last-child');
    const urlEl = document.querySelector('.playbackSoundBadge__titleLink');
    
    return {
      title: artworkEl ? artworkEl.getAttribute('aria-label') : '',
      author: authorEl ? authorEl.textContent.trim() : '',
      artwork: artworkEl ? artworkEl.style.backgroundImage.replace(/^url\\(['"]?|['"]?\\)$/g, '') : '',
      elapsed: elapsedEl ? elapsedEl.textContent.trim() : '',
      duration: durationEl ? durationEl.textContent.trim() : '',
      isPlaying: isPlaying,
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
    
    if (stateChanged || trackChanged || elapsedChanged || !window.__initialStateSent) {
      isCurrentlyPlaying = trackInfo.isPlaying;
      currentTrackTitle = trackInfo.title;
      currentTrackAuthor = trackInfo.author;
      currentTrackUrl = trackInfo.url;
      currentTrackElapsed = trackInfo.elapsed;
      currentTrackDuration = trackInfo.duration;
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
        // Wait a bit longer for track to change
        setTimeout(notifyPlaybackStateChange, 300);
      });
    }
    
    if (nextButton && !nextButton.__monitored) {
      nextButton.__monitored = true;
      nextButton.addEventListener('click', () => {
        console.debug('Next track button clicked');
        // Wait a bit longer for track to change
        setTimeout(notifyPlaybackStateChange, 300);
      });
    }

    monitorTimelineSeeking();
    monitorWaveformClicks();
  }

  function monitorWaveformClicks() {
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
    }
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
    }
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
        const trackChanged = trackInfo.title !== currentTrackTitle ||
                            trackInfo.author !== currentTrackAuthor ||
                            trackInfo.url !== currentTrackUrl;
        const playStateChanged = trackInfo.isPlaying !== isCurrentlyPlaying;
        
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
        
        if (trackChanged || playStateChanged || isLoop) {
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
    
    // Re-monitor elapsed time if the element gets replaced/recreated
    const bodyObserver = new MutationObserver(() => {
      const elapsedEl = document.querySelector('.playbackTimeline__timePassed span:last-child');
      if (elapsedEl && !elapsedObserver) {
        monitorElapsedTime();
      }
    });
    
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (elapsedObserver) {
      elapsedObserver.disconnect();
      elapsedObserver = null;
    }
  });
  
  // Start monitoring
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initialize();
  } else {
    document.addEventListener('DOMContentLoaded', initialize);
  }
})();
`;
