/**
 * @module utils/asyncHandler
 * @description Обгортка для асинхронних обробників маршрутів. Express 4 не перехоплює
 * відхилені проміси, тому помилку з async-функції явно передаємо в next() —
 * далі її обробляє централізований errorHandler.
 */

/**
 * Обгортає асинхронний обробник маршруту.
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} handler - async-обробник.
 * @returns {import('express').RequestHandler} обробник, що передає помилки в next().
 */
export default function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    handler(req, res, next).catch(next);
  };
}
