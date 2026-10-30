const vm=require('vm'),fs=require('fs'),assert=require('assert');
const c=vm.createContext({console,Math,Map});
vm.runInContext('let seed=2718,clockT=10;const EDGE_X=8,CROSS_W=8,CHUNK_LEN=48;function rngN(s){let x=s;return()=>((x=(Math.imul(x,1664525)+1013904223)|0)>>>0)/4294967296;}',c);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'board.js'),'utf8'),c);
vm.runInContext(`
const ch={slot:1,z0:48,lots:[{seed:7,H:8,tier:1,name:'LOCAL SHOP',forSale:true},{seed:9,H:8,tier:1,name:'HOME',forSale:true}],props:[]};
rememberStreet(ch);if(ch.residentShare!==1)throw Error('initial population');
lifeAge=28;evolveStreet(ch);if(!ch.lots[0].vacant||ch.lots[1].vacant)throw Error('selective redevelopment');
if(ch.residentShare>=1)throw Error('population decline');
const height=ch.lots[0].H;evolveStreet(ch);if(height!==ch.lots[0].H)throw Error('repeated growth');
const revisit={slot:1,z0:528,lots:[{seed:7,H:8,tier:1,name:'LOCAL SHOP'},{seed:9,H:8,tier:1,name:'HOME'}],props:[]};rememberStreet(revisit);
if(revisit.lots[0].H!==height||revisit.lots[0].formerName!=='LOCAL SHOP')throw Error('lost memory');
zone=1;lifeAge=24;const outer={slot:1,z0:528,lots:[{seed:7,H:8,tier:1,name:'OTHER'}],props:[]};rememberStreet(outer);if(outer.lots[0].vacant)throw Error('zone collision');
console.log('PASS: stable revisit, selective redevelopment, population decline, idempotence, zone separation');`,c);
