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
