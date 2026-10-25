// Змеи и лестницы — серверная часть (комнаты, ходы, боты)
'use strict';
const MP=[{n:'Лес',e:'🌲',t:'баланс',a:'#f6f0d4',b:'#d3e8b4',nf:'#4a3512',ns:'#fff',b1:'#1f6b3a',b2:'#2f9e8f',l:.075,s:.07,d:.06,h:.05,r:.025,x:.03},
{n:'Пустыня',e:'🏜️',t:'много ловушек',a:'#fbe8c0',b:'#f0c987',nf:'#5a3a10',ns:'#fff',b1:'#a8431a',b2:'#d98a1f',l:.065,s:.06,d:.06,h:.05,r:.04,x:.03},
{n:'Лёд',e:'❄️',t:'змей больше',a:'#f2fbff',b:'#c4e3f6',nf:'#1d3d5c',ns:'#fff',b1:'#1b4f9c',b2:'#3db6d6',l:.065,s:.08,d:.05,h:.05,r:.03,x:.04},
{n:'Вулкан',e:'🌋',t:'жёсткий урон',a:'#5b4141',b:'#472f2f',nf:'#ffe9c8',ns:'#000',b1:'#3d0b0b',b2:'#c2410c',l:.06,s:.06,d:.085,h:.04,r:.03,x:.035}];
function mkMap(mi,T){let TY=[],J={};const R_=()=>T/10;
function mul(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gen1(sd){const M=MP[mi],rnd=mul(T*31+mi*977+5+sd*7919),R=(a,b)=>a+Math.floor(rnd()*(b-a+1));TY=new Array(T+1).fill('');J={};
 const fr=n=>n>1&&n<T&&!TY[n],cn=Math.round(T/25);
 for(let k=1;k<=cn;k++){let n=Math.round(k*T/(cn+1))+R(-2,2);while(!fr(n))n++;TY[n]='C'}
 const jump=(c,up)=>{let t=0;while(c>0&&t++<3000){const L=R(6,up?20:18),a=R(2,T-1),b=up?a+L:a-L;if(b<2||b>=T||!fr(a)||!fr(b))continue;const[ax,ay]=xy(a),[bx,by]=xy(b),dd=Math.hypot(ax-bx,ay-by);if(dd>56||dd<14)continue;TY[a]=up?'L':'S';TY[b]='e';J[a]=b;c--}};
 jump(Math.round(T*M.l),1);jump(Math.round(T*M.s),0);
 for(const[k,r]of[['D',M.d],['H',M.h],['R',M.r],['X',M.x]]){let c=Math.round(T*r),t=0;while(c>0&&t++<3000){const n=R(2,T-1);if(fr(n)){TY[n]=k;c--}}}}
const KF=[1,1.02,1.08,.96];
function solo(){const r=mul(12345),N=300;let s=0;for(let g=0;g<N;g++){let p=0,sk=0;for(;;){s++;if(sk){sk--;continue}const d=1+r()*6|0;let dir=1;for(let k=0;k<d;k++){p+=dir;if(p==T&&k<d-1)dir=-1}if(p==T)break;if(J[p])p=J[p];else if(TY[p]=='R')sk=1}}return s/N}
function gen(){const goal=(T/3.5+3)*KF[mi];let best=1e9,bs=0;for(let sd=0;sd<30;sd++){gen1(sd);const e=Math.abs(solo()-goal);if(e<best){best=e;bs=sd}}gen1(bs)}
function xy(n){const r=(n-1)/10|0,k=(n-1)%10,c=r%2?9-k:k;return[c*10+5,(R_()-1-r)*10+5]}
gen();return{TY,J}}
module.exports=(send,BOT,APP)=>{
const SR={},st=new WeakMap(),sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const auto=p=>p.bot||!p.ws,pl=(id,name,bot,ws)=>({id,name,bot,ws:ws||null,pos:0,hp:100,cp:0,skip:0});
const foes=(R,i)=>R.P.map((p,j)=>j).filter(j=>j!==i);
const code=()=>{let c;do{c='';for(let k=0;k<4;k++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]}while(SR[c]);return c};
function view(R,pi){const pd=R.pend;return{room:R.code,phase:R.phase,you:pi,host:R.P[pi].id===R.host,mi:R.mi,T:R.T,gid:R.gid,cur:R.cur,winner:R.win,bd:R.phase==='lobby'?null:R.map,bot:BOT,app:APP,
 P:R.P.map(p=>({name:p.name,pos:p.pos,hp:p.hp,cp:p.cp,skip:p.skip,bot:!!p.bot,on:!!p.ws})),wait:pd?pd.i:-1,
 ask:pd&&pd.i===pi?(pd.t==='D'?{t:'D',en:foes(R,pi).map(j=>({j,name:R.P[j].name,hp:R.P[j].hp}))}:{t:'C'}):null}}
function push(R){const ev=R.ev;R.ev=[];R.P.forEach((p,i)=>p.ws&&send(p.ws,{s:'sl',v:view(R,i),ev}))}
function sched(R){if(R.phase!=='play'||R.pend||!R.P.some(p=>!p.bot&&p.ws))return;clearTimeout(R.tm);
 if(auto(R.P[R.cur]))R.tm=setTimeout(()=>{if(R.phase==='play'&&!R.pend&&auto(R.P[R.cur]))turn(R)},2800)}
function end(R){R.cur=(R.cur+1)%R.P.length;push(R);sched(R)}
function hurt(R,k,v){const q=R.P[k],e={k:'hit',i:k,v};q.hp-=v;
 if(q.hp<=0){q.hp=100;q.pos=q.cp;q.skip=0;e.dead=1;e.pos=q.pos;e.t=`💀 ${q.name} погиб → ${q.cp?'чекпоинт '+q.cp:'старт'}`}else e.t=`${R.P[R.cur].name} бьёт ${q.name}: −${v}`;R.ev.push(e)}
function turn(R){if(R.phase!=='play'||R.pend)return;clearTimeout(R.tm);const i=R.cur,p=R.P[i],T=R.T,ev=R.ev;
 if(p.skip){p.skip--;ev.push({k:'skip',i,t:`${p.name}: пропускает ход 🪤`});return end(R)}
 const d=1+Math.random()*6|0,path=[];ev.push({k:'roll',i,d,t:`${p.name}: выпало ${d}`});
 let dir=1;for(let k=0;k<d;k++){p.pos+=dir;path.push(p.pos);if(p.pos===T&&k<d-1)dir=-1}ev.push({k:'mv',i,path});
 if(p.pos===T){R.phase='over';R.win=i;ev.push({k:'win',i,t:`🏆 ${p.name} победил!`});return push(R)}
 land(R,i)}
function land(R,i){const p=R.P[i],t=R.map.TY[p.pos],j=R.map.J[p.pos],ev=R.ev;
 if(j){ev.push({k:'jump',i,to:j,t:`${p.name}: ${j>p.pos?'лестница ⬆':'змея ⬇'} ${j}`});p.pos=j;return end(R)}
 if(t==='D'){if(!foes(R,i).length)return end(R);if(!auto(p)){ev.push({k:'msg',i,t:'💥 Урон −15!'});return ask(R,'D',i)}pick(R,null,i);return}
 if(t==='H'){p.hp=Math.min(100,p.hp+5);ev.push({k:'heal',i,v:5,t:`${p.name}: лечение +5`})}
 else if(t==='R'){p.skip=1;ev.push({k:'trap',i,t:`${p.name}: капкан 🪤 пропуск хода`})}
 else if(t==='X'){const a=R.P.map((q,k)=>k).filter(k=>R.P[k].pos>p.pos).sort((x,y)=>R.P[x].pos-R.P[y].pos)[0];
  if(a==null){p.hp=Math.min(100,p.hp+10);ev.push({k:'heal',i,v:10,t:`${p.name}: ты первый — лечение +10`})}
  else{const s=p.pos;p.pos=R.P[a].pos;R.P[a].pos=s;ev.push({k:'swap',i,a,pi:p.pos,pa:s,t:`${p.name} меняется с ${R.P[a].name}`})}}
 else if(t==='C'){if(!auto(p)){ev.push({k:'msg',i,t:'🚩 Чекпоинт!'});return ask(R,'C',i)}pick(R,1,i);return}
 end(R)}
function ask(R,t,i){R.pend={t,i};clearTimeout(R.tm);R.tm=setTimeout(()=>pick(R,null),15000);push(R)}
function pick(R,v,forced){const pd=R.pend||(forced!=null&&{i:forced,t:R.map.TY[R.P[forced].pos]});if(!pd)return;clearTimeout(R.tm);R.pend=null;const i=pd.i,p=R.P[i];
 if(pd.t==='D'){const en=foes(R,i);const k=en.includes(v)?v:en.sort((a,b)=>R.P[b].pos-R.P[a].pos)[0];hurt(R,k,15)}
 else if(v==null||v){p.cp=p.pos;R.ev.push({k:'cp',i,t:`${p.name}: чекпоинт сохранён`})}
 end(R)}
function start(R){R.P=sh(R.P.filter(p=>p.bot||p.ws));R.map=mkMap(R.mi,R.T);R.gid++;R.P.forEach(p=>Object.assign(p,{pos:0,hp:100,cp:0,skip:0}));
 R.phase='play';R.cur=0;R.win=-1;R.pend=null;R.ev=[];clearTimeout(R.tm);push(R);sched(R)}
function mk(host,m){const c=code();return SR[c]={code:c,host,P:[],phase:'lobby',mi:[0,1,2,3].includes(m.mi)?m.mi:0,T:m.T===300?300:150,gid:0,ev:[],pend:null,cur:0,win:-1,idle:Date.now(),tm:null,map:null}}
function leave(s){const r=s.R;if(!r)return;s.R=null;r.idle=Date.now();const i=r.P.findIndex(p=>p.id===s.U.id);if(i<0||(r.P[i].ws&&r.P[i].ws!==s.ws))return;
 if(r.phase==='lobby'){r.P.splice(i,1);const h=r.P.find(p=>!p.bot&&p.ws);if(!h){clearTimeout(r.tm);delete SR[r.code];return}if(r.host===s.U.id)r.host=h.id}
 else{r.P[i].ws=null;if(r.pend&&r.pend.i===i)pick(r,null)}push(r)}
function handle(ws,U,m){let s=st.get(ws);if(!s)st.set(ws,s={ws});s.U=U;const err=t=>send(ws,{s:'err',t});
 const join=c=>{const r=SR[String(c||'').toUpperCase()];if(!r)return err('Комната не найдена');let i=r.P.findIndex(p=>p.id===U.id);
  if(i<0){if(r.phase!=='lobby')return err('Игра уже идёт');if(r.P.length>=8)return err('Комната полна');r.P.push(pl(U.id,U.name,0));i=r.P.length-1}
  s.R=r;r.P[i].ws=ws;r.idle=Date.now();push(r);sched(r)};
 if(m.a==='s_create'){leave(s);const r=mk(U.id,m);return join(r.code)}
 if(m.a==='s_join'){leave(s);return join(m.room)}
 if(m.a==='s_solo'){leave(s);const r=mk(U.id,m);join(r.code);const n=Math.min(7,Math.max(1,m.n|0||1));for(let k=1;k<=n;k++)r.P.push(pl('b'+k,'Бот '+k,1));return start(r)}
 const R=s.R;if(!R)return;R.idle=Date.now();const pi=R.P.findIndex(p=>p.id===U.id);if(pi<0)return;
 if(m.a==='s_leave')return leave(s);
 const host=R.host===U.id;
 if(m.a==='s_cfg'&&host&&R.phase==='lobby'){if([0,1,2,3].includes(m.mi))R.mi=m.mi;if(m.T===150||m.T===300)R.T=m.T;return push(R)}
 if(m.a==='s_bot'&&host&&R.phase==='lobby'&&R.P.length<8){R.P.push(pl('b'+Date.now(),'Бот '+(R.P.filter(p=>p.bot).length+1),1));return push(R)}
 if(m.a==='s_start'&&host&&(R.phase==='lobby'||R.phase==='over')){if(R.P.filter(p=>p.bot||p.ws).length<2)return err('Нужно минимум 2 игрока');return start(R)}
 if(R.phase!=='play')return;
 if(m.a==='s_roll'&&R.cur===pi&&!R.pend)return turn(R);
 if(m.a==='s_pick'&&R.pend&&R.pend.i===pi)return pick(R,+m.v)}
setInterval(()=>{for(const c in SR){const r=SR[c];if(!r.P.some(p=>p.ws)&&Date.now()-r.idle>6e5){clearTimeout(r.tm);delete SR[c]}}},6e4);
return{handle,close:ws=>{const s=st.get(ws);if(s&&s.R)leave(s)}}};
