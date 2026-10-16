/* ============================================================
   Event log
   ============================================================ */
function logE(msg, cls = '') {
  if (!S) return;
  S.log.unshift({t: S.t, msg, cls});
  if (S.log.length > 200) S.log.pop();
  logDirty = true;
}
let logDirty = true;
