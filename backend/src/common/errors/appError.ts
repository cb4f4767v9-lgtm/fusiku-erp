export type AppErrorType = 'TRANSIENT' | 'SYSTEM' | 'BUSINESS' | 'SECURITY';
export type AppErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AppErrorDependency = 'DB' | 'REDIS' | 'OPENAI' | 'API';

export type StandardErrorShape = {
  code: string;
  type: AppErrorType;
  severity: AppErrorSeverity;
  retryable: boolean;
  dependency: AppErrorDependency;
  message?: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

export class AppError extends Error {
  public readonly code: string;
  public readonly type: AppErrorType;
  public readonly severity: AppErrorSeverity;
  public readonly retryable: boolean;
  public readonly dependency: AppErrorDependency;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(args: {
    code: string;
    type: AppErrorType;
    severity: AppErrorSeverity;
    retryable: boolean;
    dependency: AppErrorDependency;
    message: string;
    statusCode?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'AppError';
    this.code = args.code;
    this.type = args.type;
    this.severity = args.severity;
    this.retryable = args.retryable;
    this.dependency = args.dependency;
    this.statusCode = typeof args.statusCode === 'number' ? args.statusCode : 500;
    this.details = args.details;
    if (args.cause !== undefined) {
      // Node 16+ supports Error.cause
      (this as any).cause = args.cause;
    }
  }
}

export function toStandardErrorShape(err: unknown, extras?: { requestId?: string }): StandardErrorShape {
  if (err instanceof AppError) {
    return {
      code: err.code,
      type: err.type,
      severity: err.severity,
      retryable: err.retryable,
      dependency: err.dependency,
      message: err.message,
      details: err.details,
      requestId: extras?.requestId,
    };
  }

  const e = err as any;
  const msg = typeof e?.message === 'string' ? e.message : 'Unexpected error';
  return {
    code: 'UNHANDLED_ERROR',
    type: 'SYSTEM',
    severity: 'HIGH',
    retryable: false,
    dependency: 'API',
    message: msg,
    details: typeof e === 'object' && e ? { name: e.name } : undefined,
    requestId: extras?.requestId,
  };
}

