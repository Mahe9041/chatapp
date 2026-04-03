// =============================================================================
// errors/errors.ts
// Named error subclasses — import and throw these, never raw AppError.
// =============================================================================

import { AppError } from "./AppError";

/** 404 — entity not found */
export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

/** 401 — not authenticated */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

/** 403 — authenticated but not allowed */
export class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403, 'FORBIDDEN');
    }
}

/** 422 — request body failed validation */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 422, 'VALIDATION_ERROR');
    }
}

/** 409 — resource already exists */
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

/** 429 — too many requests */
export class RateLimitError extends AppError {
    constructor(message = 'Too many requests, please try again later') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

/** 500 — unexpected server crash (non-operational) */
export class InternalError extends AppError {
    constructor(message = 'An unexpected error occurred') {
        super(message, 500, 'INTERNAL_ERROR', false); // isOperational = false → alert
    }
}