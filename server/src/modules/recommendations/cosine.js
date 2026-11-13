//векторні операції Recommendation Engine через mathjs (розділ 3.3.1 ПЗ)
import { add, divide, dot, norm } from 'mathjs';

//вектор уподобань — середнє векторів прослуханих треків: A_user = (1/k) · Σ B_j
export function preferenceVector(vectors) {
  if (vectors.length === 0) {
    throw new Error('Для вектора уподобань потрібен хоча б один прослуханий трек');
  }
  const [first, ...rest] = vectors;
  const sum = rest.reduce((acc, vector) => add(acc, vector), first);
  return divide(sum, vectors.length);
}

//косинусна подібність sim(A, B) = (A · B) / (‖A‖ · ‖B‖); для нульового вектора — 0
export function cosineSimilarity(a, b) {
  const denominator = norm(a) * norm(b);
  if (denominator === 0) return 0;
  return dot(a, b) / denominator;
}
