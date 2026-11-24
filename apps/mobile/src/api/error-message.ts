import axios from 'axios';

interface ApiErrorResponse {
  error?: { message?: string };
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return message;
    if (!error.response) return 'Cannot reach LandConnect. Check your network and API address.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
