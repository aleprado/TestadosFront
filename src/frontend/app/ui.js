export function showPopup(message, { confirm = false } = {}) {

    let overlay = document.getElementById('popupOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'popupOverlay';
        overlay.className = 'popup-overlay';
        overlay.innerHTML = `
            <div class="popup-box">
                <img src="../favicon.png" class="popup-logo" alt="logo">
                <div class="popup-content">
                    <span id="popupMessage"></span>
                    <div class="popup-buttons">
                        <button id="popupOkButton" class="btn">Aceptar</button>
                        <button id="popupCancelButton" class="btn btn-secondary">Cancelar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }

    const okButton = overlay.querySelector('#popupOkButton');
    const cancelButton = overlay.querySelector('#popupCancelButton');

    return new Promise((resolve) => {
        overlay.querySelector('#popupMessage').textContent = message;
        cancelButton.style.display = confirm ? 'inline-block' : 'none';
        overlay.style.display = 'flex';

        okButton.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };

        cancelButton.onclick = () => {
            overlay.style.display = 'none';
            resolve(false);
        };
    });
}
