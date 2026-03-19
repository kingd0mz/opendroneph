import axios from "axios";

export class ApiError extends Error {
  statusCode: number | null;
  data: unknown;

  constructor(message: string, options?: { statusCode?: number | null; data?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.statusCode = options?.statusCode ?? null;
    this.data = options?.data;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase();
  if (method && ["post", "put", "patch", "delete"].includes(method)) {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      config.headers.set("X-CSRFToken", csrfToken);
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ??
      error.message ??
      "An unexpected API error occurred.";
    return Promise.reject(
      new ApiError(message, {
        statusCode: error.response?.status ?? null,
        data: error.response?.data,
      }),
    );
  },
);
