
/* ---------- boot ---------- */
UI.draw=()=>{if(AN.mode==='sim')draw();};UI.refresh=refreshAll;UI.invalidate=anInvalidate;UI.levelChanged=()=>{buildLevels();renderAllPanes();};UI.mode=()=>AN.mode;
buildTabs();loadLevel(0);{const c=configFromHash();if(c){try{applyConfig(c);logE('Setup restored from the link','ok');}catch(e){logE('Could not restore the setup from the link: '+e.message,'warn');}}}syncModeUI();renderLearn();lessonFromHash();readTokens();draw();drawPlot();
requestAnimationFrame(loop);
window.__an={AN,anCompute,LESSONS_EXTRA,LESSON_GROUPS,spdCompute,runStepTest,runInjection,setMode,setUIMode,openLesson,lessonBack,get lessonOpen(){return lessonOpen;},lessonGo,LESSONS,stepMetrics,Ljw,anBuild};window.__nav={scatter:()=>scatterParticles(),get S(){return S;},P,LEVELS,loadLevel,advance,setParam,get WPS(){return WPS;},toScreen:(x,y)=>toScreen(x,y),get VIEW(){return VIEW;},get GHOST(){return GHOST;},EXP,expCSV,configURL,get LV(){return LV;},SLOTS,slotLoad,slamLandmarks,tryGo};
