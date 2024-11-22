export function checkLogin() {
    const username = localStorage.getItem("username");
    if (!username) {
        window.location.href = "login.html";
        return null;
    }
    return username;
}

export function login(username, password) {
    if (password === "pass") {
        localStorage.setItem("username", username);
        window.location.href = "localidades.html";
    } else {
        alert("Credenciales incorrectas. Inténtalo de nuevo.");
    }
}

export function logout() {
    localStorage.removeItem("username");
    window.location.href = "login.html";
}
