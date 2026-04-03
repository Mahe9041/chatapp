// =============================================================================
// errors/AppError.ts
// Base error class for all application-level errors.
//
// isOperational: true  → expected business error (4xx)
//                         handled gracefully, not alerted
// isOperational: false → programmer error / crash (5xx)
//                         logged + alerted, should trigger investigation
// =============================================================================

/**
 * Base class for all thrown errors in the application.
 * Always throw a subclass — never throw raw `Error` in business logic.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number,
        code: string,
        isOperational = true,
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        // Maintains proper stack trace in V8
        Error.captureStackTrace(this, this.constructor);
    }
}

