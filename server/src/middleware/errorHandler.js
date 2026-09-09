import { ZodError } from 'zod';
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError)
    return res
      .status(400)
      .json({
        error: {
          message: error.issues
            .map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`)
            .join('; ')
        }
      });
  const codes = {
    P2002: [409, 'This record already exists.'],
    P2003: [409, 'This record is still in use.'],
    P2025: [404, 'Record not found.'],
    P2034: [409, 'A concurrent update occurred. Please try again.']
  };
  const [status, message] = codes[error.code] || [
    error.status || 500,
    error.status ? error.message : 'Something went wrong. Please try again.'
  ];
  if (status === 500) console.error(error);
  res.status(status).json({ error: { message } });
}
