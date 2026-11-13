//Express 4 не перехоплює відхилені проміси, тому помилку явно передаємо в next()
export default function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    handler(req, res, next).catch(next);
  };
}
