import { request } from './client.js';

export function fetchPopular(signal) {
  return request('/recommendations/popular', { signal });
}

//якщо історія прослуховувань коротша за поріг M, сервер повертає source: "popular"
export function fetchPersonal(signal) {
  return request('/recommendations/personal', { signal });
}
