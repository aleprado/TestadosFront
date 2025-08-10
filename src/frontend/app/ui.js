export function showPopup(message, { confirm = false } = {}) {

    let overlay = document.getElementById('popupOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'popupOverlay';
        overlay.className = 'popup-overlay';
        overlay.innerHTML = `
            <div class="popup-box">
                <div class="popup-content">
                    <img src="../favicon.png" class="popup-logo" alt="logo">
                    <span id="popupMessage"></span>
                </div>
                <div class="popup-buttons">
                    <button id="popupOkButton" class="btn">Aceptar</button>
                    <button id="popupCancelButton" class="btn btn-secondary">Cancelar</button>
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

export function showUserFormPopup() {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = `
        <div class="popup-box">
            <h2 class="popup-titulo">Registrar Usuario</h2>
            <div class="popup-content">
                <div class="popup-form">
                    <input type="text" id="popupNombreUsuario" class="input-field" placeholder="Nombre">
                    <input type="text" id="popupEmailUsuario" class="input-field" placeholder="Email">
                </div>
            </div>
            <div class="popup-buttons">
                <button id="popupOkButton" class="btn">Registrar</button>
                <button id="popupCancelButton" class="btn btn-secondary">Cancelar</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    return new Promise((resolve) => {
        overlay.style.display = 'flex';
        overlay.querySelector('#popupOkButton').onclick = () => {
            const nombre = overlay.querySelector('#popupNombreUsuario').value.trim();
            const email = overlay.querySelector('#popupEmailUsuario').value.trim();
            if (!nombre || !email) {
                showPopup('Se requiere el nombre y el email del usuario.');
                return;
            }
            document.body.removeChild(overlay);
            resolve({ nombre, email });
        };
        overlay.querySelector('#popupCancelButton').onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };
    });
}

export function mostrarMapaPopup(ruta) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = `
        <div class="popup-box mapa-popup">
            <iframe src="/mapa?ruta=${ruta}"></iframe>
            <div class="popup-buttons">
                <button id="cerrarMapa" class="btn">Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
    overlay.querySelector('#cerrarMapa').onclick = () => {
        document.body.removeChild(overlay);
    };
}

export function showLoading(message = 'Procesando...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-box">
                <div class="spinner"></div>
                <div class="loading-text"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = message;
    overlay.style.display = 'flex';
}

export function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}
