
/* ============================================================
   Worlds & levels
   ============================================================ */
const Rc=(x,y,w,h)=>({t:'r',x,y,w,h}), Ci=(x,y,r)=>({t:'c',x,y,r});
const BORDER=[Rc(0,0,24,0.2),Rc(0,15.8,24,0.2),Rc(0,0,0.2,16),Rc(23.8,0,0.2,16)];
function warehouse(){const s=[...BORDER];for(const y of [3.2,6.4,9.6,12.8]){s.push(Rc(3.5,y,7,0.8));s.push(Rc(13.5,y,7,0.8));}return s;}
const WH_BEACONS=[[3.3,3.6],[20.7,3.6],[10.7,6.8],[13.3,6.8],[3.3,10],[20.7,10],[10.7,13.2],[13.3,13.2],[12,0.45],[12,15.55],[0.45,8],[23.55,8]];
const BUILDING=[...BORDER,
  Rc(7.9,0,0.2,6),Rc(7.9,7.4,0.2,8.6),          // wall x=8, door y 6–7.4
  Rc(15.9,0,0.2,11),Rc(15.9,12.4,0.2,3.6),      // wall x=16, door y 11–12.4
  Rc(0,7.9,3,0.2),Rc(4.4,7.9,3.5,0.2),          // wall y=8 left, door x 3–4.4
  Rc(16.1,7.9,2.9,0.2),Rc(20.4,7.9,3.6,0.2),    // wall y=8 right, door x 19–20.4
  Rc(10,2,2.5,1.2),Rc(11,11,1.2,3),Rc(3,11,2,1),Rc(19,3,2,2),Ci(13,7,0.6)];

// Parking lot: parked cars are obstacles (0.56 × 1.0 m); bays are 1 m wide
const PARKING=(()=>{const s=[...BORDER,Rc(4,9.45,16,0.3)];
  for(let bx=4;bx<20;bx++){if(bx!==10&&bx!==16)s.push(Rc(bx+0.22,14.65,0.56,1.0));
    if(bx!==7&&bx!==13)s.push(Rc(bx+0.22,9.85,0.56,1.0));
    if(bx!==15&&bx!==9)s.push(Rc(bx+0.22,8.35,0.56,1.0));}
  for(const x of[4,7.2,9.7,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));   // 2.2 m parallel slot at x 5.0–7.2
  s.push(Ci(9,4.6,0.35),Ci(13,4.6,0.35),Ci(17,4.6,0.35),Rc(20.6,2.4,1.2,1.2));
  return s;})();
const LEVELS=[
 {id:'L1',name:'Open floor',
  adds:'Perfect pose and a known map, a few pillars, straight-line paths. Everything is ideal except the controller, so this is where you tune tracking.',
  tries:[
   {t:'<b>Control:</b> drop pure-pursuit L<sub>0</sub> to 0.1 m, then raise it to 2 m. Watch the cross-track plot: short lookahead oscillates, long lookahead cuts corners.',b:[['L<sub>0</sub> = 0.1 m',{set:{ppL0:0.1},tab:'ctl',plot:'cte'}],['L<sub>0</sub> = 2 m',{set:{ppL0:2},tab:'ctl',plot:'cte'}]]},
   {t:'<b>Control:</b> switch to PID and compare the same legs.',b:[['PID',{set:{ctl:'pid'},tab:'ctl',plot:'cte'}]]},
   {t:'<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.',b:[['Limits on, τ = 0.3 s',{set:{accel:true,lag:0.3},tab:'veh',plot:'v'}]]},
   {t:'<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.',b:[['MPC',{set:{ctl:'mpc'},tab:'ctl',plot:'cte'}],['N<sub>p</sub> = 3, N<sub>c</sub> = 1',{set:{ctl:'mpc',mpcNp:3,mpcNc:1},tab:'ctl',plot:'cte'}],['τ = 0.3 s, lag modeled',{set:{ctl:'mpc',lag:0.3,mpcLag:true},tab:'ctl',plot:'v'}]]}],
  shapes:[...BORDER,Ci(6,11,0.7),Ci(14,6,0.8),Ci(12,2.5,0.5),Ci(19,13.5,0.6),Rc(8,7,2,1.5)],
  beacons:[[0.45,4],[0.45,12],[12,0.45],[12,15.55],[23.55,4],[23.55,12]],peds:[],
  start:[2,2,0.6],wps:[[10,12],[20,10],[18,3],[4,8]],
  cfg:{loc:'truth',per:'oracle',mis:'sequential',plan:'straight',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0},layers:{cost:false}},
 {id:'L2',name:'Warehouse aisles',
  adds:'Shelving rows block straight lines. Pose and map are still perfect, so the global planner is the only thing that changes outcomes.',
  tries:[
   {t:'<b>Plan:</b> pick Straight line and run. The robot drives into a shelf and the stuck detector fires.',b:[['Straight line',{set:{plan:'straight'},tab:'plan'}]]},
   {t:'<b>Plan:</b> A* with ε = 1 versus ε = 3. Compare expansions and path length in the log (weighted A* is bounded by ε × optimal).',b:[['ε = 1',{set:{plan:'astar',eps:1},tab:'plan'}],['ε = 3',{set:{plan:'astar',eps:3},tab:'plan'}]]},
   {t:'<b>Plan:</b> RRT*, then change the seed and reset. Sampling planners give a different path every time.',b:[['RRT*',{set:{plan:'rrtstar'},tab:'plan'}],['RRT*, next seed',{seed:'next',set:{plan:'rrtstar'},tab:'plan'}]]},
   {t:'<b>Mission:</b> Optimal versus In order. The log shows total mission cost for each.',b:[['In order',{set:{mis:'sequential'},tab:'mis'}],['Optimal',{set:{mis:'optimal'},tab:'mis'}]]}],
  shapes:warehouse(),beacons:WH_BEACONS,peds:[],
  start:[1.5,1.5,0],wps:[[8,5.2],[17,11.2],[5,14.7],[21.8,2]],
  cfg:{loc:'truth',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0},layers:{cost:true}},
 {id:'L3',name:'Noisy odometry',
  adds:'Wheel odometry is noisy and slightly miscalibrated. The filter is not told about the calibration bias. Wall beacons give range and bearing.',
  tries:[
   {t:'<b>Localize:</b> the level starts on dead reckoning. Watch the truth and the estimate separate, and the ellipse grow.',b:[['Dead reckoning',{set:{loc:'dr'},tab:'loc',plot:'pos'}]]},
   {t:'<b>Localize:</b> switch to EKF. Then raise odometry bias in Vehicle and watch NEES climb past 3: the filter becomes overconfident.',b:[['EKF',{set:{loc:'ekf'},tab:'loc',plot:'pos'}],['EKF, bias ×3',{set:{loc:'ekf',odoB:3},tab:'veh',plot:'pos'}]]},
   {t:'<b>Localize:</b> raise the filter\'s assumed motion noise until NEES settles near 3 again.',b:[['EKF, bias ×3, assumed noise ×4',{set:{loc:'ekf',odoB:3,filtK:4},tab:'loc',plot:'pos'}]]},
   {t:'<b>Localize:</b> EKF-SLAM does not know where the beacons are. It drifts like dead reckoning until it sees a beacon it mapped early; a longer sensor range gives more overlap and bounds the drift.',b:[['EKF-SLAM',{set:{loc:'slam'},tab:'loc',plot:'pos'}],['EKF-SLAM, beacon range 12 m',{set:{loc:'slam',lmRange:12},tab:'loc',plot:'pos'}],['EKF-SLAM, unlabeled',{set:{loc:'slam',assoc:'unknown'},tab:'loc',plot:'pos'}]]},
   {t:'<b>Localize:</b> kidnap the robot. With known IDs the EKF can pull itself back. With unlabeled beacons the gate rejects every reading. The particle filter recovers either way.',b:[['EKF, kidnap at 8 s',{set:{loc:'ekf'},tab:'loc',plot:'pos',act:'kidnap'}],['Unlabeled, kidnap',{set:{loc:'ekf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}],['Particle filter, kidnap',{set:{loc:'pf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}]]},
   {t:'<b>Localize:</b> take beacons away from the EKF. With the east half off it coasts on odometry there, like dead reckoning, and snaps back in the west. Flicker costs little; long outages leave dead zones where the ellipse grows.',b:[['EKF, east beacons off',{set:{loc:'ekf',bOff:'1,3,5,7,11'},tab:'loc',plot:'pos'}],['EKF, flickering beacons',{set:{loc:'ekf',bOut:50,bOutLen:0.4},tab:'loc',plot:'pos'}],['EKF, long outages',{set:{loc:'ekf',bOut:70,bOutLen:6},tab:'loc',plot:'pos'}]]}],
  shapes:warehouse(),beacons:WH_BEACONS,peds:[],
  start:[1.5,1.5,0],wps:[[21.8,2],[21.8,14.5],[12,8.4],[2,14.5],[2,5]],
  cfg:{loc:'dr',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:1,accel:false,lag:0,assoc:'known',clutter:0,replan:0},layers:{cost:false}},
 {id:'L4',name:'Unknown building',
  adds:'No prior map. Lidar builds an occupancy grid in the estimated frame, and the planner treats unknown space as free and replans as walls appear.',
  tries:[
   {t:'<b>Mission:</b> follow the replans in the event log as rooms are discovered.',b:[['Run',{tab:'mis'}]]},
   {t:'<b>Perceive:</b> set unknown space to lethal. Goals in unexplored rooms become unreachable, which is the gap frontier-based exploration fills.',b:[['Unknown = lethal',{set:{unknownAs:'lethal'},tab:'per'}]]},
   {t:'<b>Localize:</b> switch to dead reckoning and watch the map smear: mapping inherits pose error.',b:[['Dead reckoning',{set:{loc:'dr'},tab:'loc'}]]},
   {t:'<b>Layers:</b> hide the true-map ghost and judge the map as the robot sees it.',b:[['Hide the ghost',{layers:{ghost:false},tab:'view',keep:true}]]},
   {t:'<b>Control:</b> MPC with obstacle constraints handles the tight rooms. Switch it to LTV, which cannot take nonconvex obstacle constraints, and watch it clip the table.',b:[['MPC',{set:{ctl:'mpc'},tab:'ctl'}],['LTV',{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}]]}],
  shapes:BUILDING,
  beacons:[[0.45,4],[0.45,12],[7.65,3],[7.65,12],[8.35,3],[8.35,12],[12,0.45],[12,15.55],[15.65,5],[16.35,14],[23.55,4],[23.55,12],[2,7.65],[6,8.35],[18,8.35],[22,7.65]],peds:[],
  start:[2,2,0],wps:[[5,13],[13.5,14],[21,13],[22.5,5.5]],
  cfg:{loc:'ekf',per:'mapping',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:false,lag:0,assoc:'known',clutter:0,replan:0},layers:{cost:false}},
 {id:'L5',name:'Busy floor',
  adds:'Prior map, but people walk the aisles. A lidar tracker estimates where they are and how fast they move, and a speed planner predicts where they will be. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
  tries:[
   {t:'<b>Control:</b> pure pursuit runs with the response to agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.',b:[['Speed planning',{tab:'ctl',plot:'st'}],['Ignore',{set:{spd:'none'},tab:'ctl'}],['Reactive stop',{set:{spd:'stop'},tab:'ctl'}]]},
   {t:'<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.',b:[['Static prediction',{set:{agPred:'static'},tab:'per',plot:'st'}]]},
   {t:'<b>Perceive:</b> switch Agent tracking from Lidar to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.',b:[['Ground truth',{set:{agents:'truth'},tab:'per'}]]},
   {t:'<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Agent tracking off, which treats every lidar hit as a static obstacle at the moment of the scan. MPC respects the acceleration limits exactly; tick Include actuator lag, since τ = 0.15 s here.',b:[['DWA',{set:{ctl:'dwa'},tab:'ctl'}],['DWA, tracking off',{set:{ctl:'dwa',agents:'off'},tab:'ctl'}],['MPC',{set:{ctl:'mpc',mpcLag:true},tab:'ctl'}],['MPC, tracking off',{set:{ctl:'mpc',mpcLag:true,agents:'off'},tab:'ctl'}]]},
   {t:'<b>Localize:</b> scatter the particles. With unlabeled beacons this warehouse is nearly 180° symmetric, so the filter can lock onto the mirror pose. Switch to Known IDs and scatter again.',b:[['Scatter at 8 s',{tab:'loc',act:'scatter'}],['Known IDs, scatter',{set:{assoc:'known'},tab:'loc',act:'scatter'}]]},
   {t:'<b>Vehicle:</b> raise false detections and watch gating and robust weights hold.',b:[['2 false detections per scan',{set:{clutter:2},tab:'veh'}]]},
   {t:'<b>Vehicle:</b> make the people react. With social forces they step around the robot, so even Ignore looks better than it is; the contact counts tell the story.',b:[['Reactive people, speed planning',{set:{people:'reactive'},tab:'veh'}],['Reactive people, ignore',{set:{people:'reactive',spd:'none'},tab:'ctl'}]]},
   {t:'<b>Vehicle:</b> add sensor latency. The lidar and the beacons arrive 0.2 s late and the filter processes stale readings against a prediction that has moved on; the particle filter loses the robot and recovers.',b:[['Sensor latency 0.2 s',{set:{sensLat:0.2},tab:'veh',plot:'pos'}]]},
   {t:'<b>Plan:</b> Space-time A* plans in (x, y, t) against the predicted people and will wait in a doorway rather than detour. Compare its replans with A* in the log.',b:[['Space-time A*',{set:{plan:'stastar'},tab:'plan',layers:{search:true}}]]}],
  shapes:warehouse(),beacons:WH_BEACONS,
  peds:[{a:[3,5.2],b:[21,5.2],v:0.8,s0:0.3},{a:[12,1],b:[12,15],v:0.7,s0:0.5},{a:[21,8.4],b:[3,8.4],v:0.9,s0:0.1},{a:[2,14.6],b:[22,14.6],v:0.6,s0:0.7}],
  start:[1.5,1.5,0],wps:[[21.8,2],[17,11.2],[2,14.5],[8,5.2],[21.8,14.5]],
  cfg:{loc:'pf',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:true,lag:0.15,assoc:'unknown',clutter:0.5,replan:2,lostGuard:true,agents:'lidar',spd:'st'},layers:{cost:false}},
 {id:'L6',name:'Parking lot',
  adds:'The robot becomes a car: kinematic bicycle model, 32° steering limit, a turning radius near 1 m, and a body that cannot turn in place. Goals now carry a heading: reverse into a bay, nose into another, then parallel park. People cross the lanes on their way to and from cars, pausing before they turn back.',
  tries:[
   {t:'<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.',b:[['Hybrid A*',{tab:'plan'}],['A*',{set:{plan:'astar'},tab:'plan'}]]},
   {t:'<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.',b:[['Reeds–Shepp',{set:{plan:'rs'},tab:'plan'}]]},
   {t:'<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.',b:[['No reversing',{set:{revOK:false},tab:'plan'}]]},
   {t:'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.',b:[['2D heuristic',{set:{hybH:'2d'},tab:'plan'}],['Planner at 100 %',{set:{planPct:100},tab:'plan'}]]},
   {t:'<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.',b:[['DWA',{set:{ctl:'dwa'},tab:'ctl'}]]},
   {t:'<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.',b:[['Pure pursuit',{set:{ctl:'pp'},tab:'ctl',plot:'cte'}],['Stanley, rate 0.5 rad/s',{set:{ctl:'stanley',steerRate:0.5},tab:'veh',plot:'turn'}]]},
   {t:'<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.',b:[['EKF, noise ×2',{set:{loc:'ekf',odoK:2},tab:'loc',plot:'pos'}]]},
   {t:'<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.',b:[['MPC',{set:{ctl:'mpc'},tab:'ctl'}],['LTV',{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}]]},
   {t:'<b>Control:</b> people cross the lanes. With the response to agents set to Speed planning the car keeps its maneuver and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.',b:[['Speed planning',{tab:'ctl',plot:'st'}],['Ignore',{set:{spd:'none'},tab:'ctl'}],['Reactive stop',{set:{spd:'stop'},tab:'ctl'}]]},
   {t:'<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.',b:[['Static prediction',{set:{agPred:'static'},tab:'per',plot:'st'}],['Horizon 1 s',{set:{agT:1},tab:'per',plot:'st'}]]},
   {t:'<b>Vehicle:</b> another car drives the lanes and yields when the robot is close ahead. The tracker sees it as a wide cluster; the speed planner treats it like any agent. Turn it off to compare.',b:[['Vehicles on',{tab:'veh'}],['Vehicles off',{set:{vehicles:false},tab:'veh'}],['Reactive people too',{set:{people:'reactive'},tab:'veh'}]]},
   {t:'<b>Vehicle:</b> the same car with tyres that slip (Vehicle → Car, dynamic). With grippy tyres it parks like the kinematic car (4/4, the yaw rate within 0.2 % of v tanδ / L); on the slippery floor it understeers in every turn, its yaw rate 4 % below v tanδ / L on average, and still parks all four, reverse legs included. The Sideslip arrow shows the centre of mass sliding, up to 19° at full lock even with grippy tyres, as for the kinematic car.',b:[['Grippy tyres',{set:{veh:'dyn',mass:10,Iz:0.9,lf:0.27,Cf:500,Cr:700,mu:0.9},tab:'veh',layers:{slip:true}}],['Slippery floor',{set:{veh:'dyn',mass:10,Iz:0.9,lf:0.27,Cf:40,Cr:90,mu:0.25},tab:'veh',layers:{slip:true}}]]}],
  shapes:PARKING,beacons:[[0.45,4],[0.45,12],[12,0.45],[12,15.55],[23.55,4],[23.55,12],[3.85,9.6],[20.15,9.6],[3.8,15.55],[20.2,15.55],[9,4.98],[17,4.98]],
  peds:[{a:[0.8,10.2],b:[3.3,10.2],v:0.5,s0:0.15,dw:3},{a:[14.8,11.2],b:[14.8,14.3],v:0.5,s0:0.18,dw:2},{a:[4.5,6.6],b:[19,6.6],v:0.7,s0:0.95,dw:1},{a:[11,1.5],b:[11,7.7],v:0.5,s0:0.48,dw:2}],
  cars:[{loop:[[3,12.4],[21,12.4],[21,6.6],[3,6.6]],v:0.6,s0:0.55}],
  start:[2,4,Math.PI/2],wps:[[10.5,15.3,-Math.PI/2],[15.5,8.35,Math.PI/2],[5.8,0.68,0],[2,13]],
  cfg:{model:'car',loc:'truth',per:'oracle',mis:'sequential',plan:'hybrid',ctl:'rwf',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3,agents:'lidar',spd:'st'},layers:{cost:false}},
];
