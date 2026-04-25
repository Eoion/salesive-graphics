import axios from "axios";
import { loadSession } from "./session";

/**
 * =============================================================
 * AUTHENTICATION API REQUESTS CONFIGURATION
 * =============================================================
 * This file configures axios for the Salesive API.
 * It uses the provided token for authentication as a fallback.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptor to always attach the latest token
api.interceptors.request.use(
    (config) => {
        const session = loadSession();
        const token = session?.token;

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

/**
 * Object for sending requests as defined in the technical specification
 */
export const auth = {
    /**
     * Initiate Google Auth (Get URL)
     * @param {boolean} redirect - If false, returns the URL as JSON
     */
    initiateGoogleAuth: (redirect = false) => {
        return api.get("/auth/google", {
            params: { redirect },
        });
    },

    /**
     * Verify JWT Token
     * Checks if the current token is still valid
     */
    verifyToken: () => {
        return api.post("/auth/verify");
    },
};

export const canvases = {
    saveDraft: (payload) => api.post("/graphics/canvases/draft", payload),
    saveCanvas: (payload) => api.post("/graphics/canvases/save", payload),
    listMine: () => api.get("/graphics/canvases/mine"),
    listPublic: () => api.get("/graphics/canvases/public"),
    getById: (id) => api.get(`/graphics/canvases/${id}`),
    deleteCanvas: (id) => api.delete(`/graphics/canvases/${id}`),
};

export const collections = {
    listMine: () => api.get("/graphics/collections/mine"),
    saveItem: (payload) => api.post("/graphics/collections/save", payload),
    deleteItem: (id) => api.delete(`/graphics/collections/${id}`),
};

export default api;
