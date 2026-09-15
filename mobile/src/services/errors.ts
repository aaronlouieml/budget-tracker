// Replaces the old ApiError - same shape (a message + optional "not found"
// status) so screens that used to catch ApiError need minimal changes.
export class ServiceError extends Error {
  status: number;
  details: string[];

  constructor(details: string[], status = 400) {
    super(details.join(', ') || 'Something went wrong');
    this.status = status;
    this.details = details;
  }
}
