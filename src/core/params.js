
/* ============================================================
   Parameters
   ============================================================ */
const DEFAULTS={loc:'truth',assoc:'known',npart:400,inject:true,pfLidar:true,filtK:1,per:'oracle',unknownAs:'free',infl:0.6,
  mis:'sequential',replan:0,lostGuard:false,rwKth:3.0,rwKe:6.0,latency:0,biasDeg:0,biasW:0,mpcMode:'nmpc',mpcNp:20,mpcNc:10,mpcDt:0.1,mpcIt:3,mpcQlat:20,mpcQlon:4,mpcQth:6,mpcQv:2,mpcQf:5,mpcRa:0.3,mpcRs:0.3,mpcRd:1.0,mpcRho:200,mpcObs:true,mpcMarg:0.1,mpcLag:false,planPct:85,model:'diff',wheelbase:0.6,steerMaxDeg:32,steerRate:1.5,revOK:true,revPen:2.0,gearPen:2.0,hybH:'both',stanK:2.0,plan:'astar',eps:1,smooth:true,rrtIt:1500,ctl:'pp',vcruise:0.8,ppL0:0.5,ppK:0.5,alat:0.6,
  kp:2.0,ki:0,kd:0.15,dwaG:1.0,dwaO:0.6,dwaV:0.4,dwaT:1.6,vmax:1.0,wmax:1.8,accel:false,amax:0.8,alpha:3.0,lag:0,
  odoK:0,odoB:0,lmK:1,lmRange:7,clutter:0,bOff:'',bOut:0,bOutLen:1,lidarSig:0.02,seed:7,agents:'off',agPred:'cv',agT:4,agGrow:0.1,agSigA:0.8,spd:'none',stMarg:0.3,agPlan:true,people:'scripted',sensLat:0,vehicles:true};
const P={...DEFAULTS};
const LAYERS={ghost:true,cost:false,search:true,lidar:true,beam:true,belief:true,trail:true,dwa:true,agents:true,ghostrun:true};
