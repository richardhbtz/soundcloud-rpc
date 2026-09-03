// Toast behaviour. Extracted from an inline <script> so the page can be served under a
// CSP that refuses inline script -- see src/utils/appProtocol.ts.

setTimeout(() => {
    document.body.style.opacity = '1';
}, 100);

setTimeout(() => {
    document.body.classList.add('fade-out');
    document.body.style.opacity = '0';
    setTimeout(() => {
        window.notificationAPI.done();
    }, 300);
}, 4500);
