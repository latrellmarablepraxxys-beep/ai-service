export type ErrorDetails = Record<string, unknown>;

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}
