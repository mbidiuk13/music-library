//помилка, яку можна безпечно показати клієнту; у JSON її перетворює errorHandler
export default class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
