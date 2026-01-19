import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { app, auth, db } from './config.js';

let analyticsInstance = null;

function getAnalyticsSafe() {
    if (analyticsInstance) return analyticsInstance;
    try {
        analyticsInstance = getAnalytics(app);
        return analyticsInstance;
    } catch (error) {
        console.warn('[metrics] Analytics no disponible', error);
        return null;
    }
}

function buildContext() {
    const page = document.body?.dataset?.page || null;
    const cliente = localStorage.getItem('cliente');
    const localidad = localStorage.getItem('localidad');
    const email = localStorage.getItem('email');
    return {
        page,
        cliente,
        localidad,
        email
    };
}

function compactPayload(payload) {
    const cleaned = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        cleaned[key] = value;
    });
    return cleaned;
}

export function trackEvent(name, payload = {}) {
    try {
        const analytics = getAnalyticsSafe();
        if (!analytics) return;
        const context = buildContext();
        const merged = compactPayload({ ...context, ...payload });
        logEvent(analytics, name, merged);
    } catch (error) {
        console.warn('[metrics] trackEvent falló', error);
    }
}

export async function auditLog(event, payload = {}) {
    try {
        const context = buildContext();
        const actor = auth.currentUser?.uid || context.email || null;
        const data = {
            event,
            actor,
            page: context.page,
            cliente: context.cliente,
            localidad: context.localidad,
            payload: compactPayload(payload),
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'AuditLogs'), data);
    } catch (error) {
        console.warn('[metrics] auditLog falló', error);
    }
}
