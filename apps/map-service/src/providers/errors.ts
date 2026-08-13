import { HttpException, HttpStatus } from '@nestjs/common';

export type ProviderErrorCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'NO_ROUTE_FOUND'
  | 'INVALID_LOCATION';

const STATUS_BY_CODE: Record<ProviderErrorCode, HttpStatus> = {
  PROVIDER_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  PROVIDER_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  NO_ROUTE_FOUND: HttpStatus.NOT_FOUND,
  INVALID_LOCATION: HttpStatus.BAD_REQUEST,
};

/**
 * Provider failures carry a stable code so the mobile client can react
 * (retry, fall back to cache, show a specific message) without string matching.
 */
export class ProviderError extends HttpException {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly provider?: string,
  ) {
    super({ code, message, provider }, STATUS_BY_CODE[code]);
  }

  /** Transient failures are worth retrying against a fallback provider. */
  get isRetryable() {
    return (
      this.code === 'PROVIDER_TIMEOUT' ||
      this.code === 'PROVIDER_UNAVAILABLE' ||
      this.code === 'PROVIDER_RATE_LIMITED'
    );
  }
}
