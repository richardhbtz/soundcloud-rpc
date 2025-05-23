export const audioMonitorScript = `
(function() {
  // Avoid duplicate injections
  if (window.__soundCloudMonitorActive) return;
  window.__soundCloudMonitorActive = true;
  
  console.debug('monitor script injected');
  
  // Track current playback state
  let isCurrentlyPlaying = false;
  
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
    
    if (stateChanged || !window.__initialStateSent) {
      isCurrentlyPlaying = trackInfo.isPlaying;
      window.__initialStateSent = true;
      
    window.soundcloudAPI.sendTrackUpdate(trackInfo, 'playback-state-change');
    console.debug('Playback state change:', trackInfo.isPlaying ? 'playing' : 'paused', trackInfo);
      
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
  }
  
  // Start monitoring
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initialize();
  } else {
    document.addEventListener('DOMContentLoaded', initialize);
  }
})();
`;