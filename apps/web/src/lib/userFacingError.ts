const opaqueServerErrorPatterns = [
  /server components render/i,
  /specific message is omitted in production builds/i,
  /avoid leaking sensitive details/i,
  /digest property/i,
];

export const isOpaqueServerErrorMessage = (message: string) =>
  opaqueServerErrorPatterns.some((pattern) => pattern.test(message));

export const userFacingErrorMessage = (error: unknown, fallback: string) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message || isOpaqueServerErrorMessage(message)) {
    return fallback;
  }

  return message;
};
