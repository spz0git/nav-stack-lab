/* ---------- the learned blocks' weights, inlined by the build from src/models/*.json (tools/code.mjs) ---------- */
const MODELS = /*__MODELS__*/ {};
// Models trained in the page (Tools → Train), by id. The page keeps them in this browser (ui/train.js) and hands the
// ones a run needs to the workers with the run; P.detModel and P.polModel pick one ('builtin': the inlined model).
const USER_MODELS = {};
function nnModel(block) {
  const id = block === 'detector' ? P.detModel : P.polModel;
  return (id && id !== 'builtin' && USER_MODELS[id]) || MODELS[block];
}
