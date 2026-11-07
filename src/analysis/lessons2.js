/* ---------- lessons on localization, perception and planning (run in the simulator) ---------- */
// Each try is a tryGo configuration with a level: it reloads that level, applies the settings and runs.
const LV_WAREHOUSE = 1,
  LV_NOISY = 2,
  LV_BUILDING = 3,
  LV_BUSY = 4;
// Written in docs/lessons/{intro,loc,per,plan,saf}/*.md and inlined by the build (analysis/lessons-data.js).
const SIM_LESSONS = {
  intro: LESSON_DATA.intro,
  loc: LESSON_DATA.loc,
  per: LESSON_DATA.per,
  plan: LESSON_DATA.plan,
  saf: LESSON_DATA.saf
};
