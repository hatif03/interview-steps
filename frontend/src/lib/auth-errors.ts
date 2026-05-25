export class EmailConfirmationRequiredError extends Error {
  constructor() {
    super("Please confirm your email before signing in.");
    this.name = "EmailConfirmationRequiredError";
  }
}

export function authErrorMessage(err: unknown): string {
  if (err instanceof EmailConfirmationRequiredError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}
