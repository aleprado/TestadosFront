export function showPopup(message) {
    let overlay = document.getElementById('popupOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'popupOverlay';
        overlay.className = 'popup-overlay';
        overlay.innerHTML = `
            <div class="popup-box">
                <img src="../favicon.png" class="popup-logo" alt="logo">
                <span id="popupMessage"></span>
                <button id="popupButton" class="btn">OK</button>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#popupButton').addEventListener('click', () => {
            overlay.style.display = 'none';
        });
    }
    overlay.querySelector('#popupMessage').textContent = message;
    overlay.style.display = 'flex';
}
