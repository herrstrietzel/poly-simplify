import polySimplify from './dist/poly-simplify.esm.js'; // or use require() if testing CJS

const ptsSimplified = polySimplify(`M0 0 h10 h10 v10 v10`);
console.log('Simplified Points:', ptsSimplified);
