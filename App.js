import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, Animated, Easing, useWindowDimensions, Platform
} from "react-native";

const initialBoard=()=>{
  const b=Array.from({length:8},()=>Array(8).fill(null));
  for(let r=1;r<=2;r++) for(let c=0;c<8;c++) b[r][c]={side:"black",king:false};
  for(let r=5;r<=6;r++) for(let c=0;c<8;c++) b[r][c]={side:"white",king:false};
  return b;
};
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const clone=b=>b.map(row=>row.map(p=>p?{...p}:null));
const countPieces=(b,side)=>b.flat().filter(p=>p&&p.side===side).length;

function rawMoves(board,side,fromOnly=null,capturesOnly=false){
  const moves=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=board[r][c];
    if(!p||p.side!==side||(fromOnly&&(fromOnly.r!==r||fromOnly.c!==c))) continue;
    if(p.king){
      for(const [dr,dc] of dirs){
        let nr=r+dr,nc=c+dc;
        while(inside(nr,nc)&&!board[nr][nc]){
          if(!capturesOnly) moves.push({from:{r,c},to:{r:nr,c:nc},captured:[]});
          nr+=dr;nc+=dc;
        }
        if(inside(nr,nc)&&board[nr][nc].side!==side){
          const enemy={r:nr,c:nc};let er=nr+dr,ec=nc+dc;
          while(inside(er,ec)&&!board[er][ec]){
            moves.push({from:{r,c},to:{r:er,c:ec},captured:[enemy]});
            er+=dr;ec+=dc;
          }
        }
      }
    }else{
      const f=side==="white"?-1:1;
      if(!capturesOnly) for(const [dr,dc] of [[f,0],[0,1],[0,-1]]){
        const nr=r+dr,nc=c+dc;
        if(inside(nr,nc)&&!board[nr][nc]) moves.push({from:{r,c},to:{r:nr,c:nc},captured:[]});
      }
      for(const [dr,dc] of [[f,0],[0,1],[0,-1]]){
        const mr=r+dr,mc=c+dc,er=r+2*dr,ec=c+2*dc;
        if(inside(mr,mc)&&inside(er,ec)&&board[mr][mc]&&board[mr][mc].side!==side&&!board[er][ec])
          moves.push({from:{r,c},to:{r:er,c:ec},captured:[{r:mr,c:mc}]});
      }
    }
  }
  return moves;
}
function chainBest(board,m,side){
  const next=applyStep(board,m,side);
  let best=0;
  for(const x of rawMoves(next,side,m.to,true)) best=Math.max(best,chainBest(next,x,side));
  return m.captured.length+best;
}
function maxCaptureOnly(board,side,caps){
  const scored=caps.map(m=>({m,n:chainBest(board,m,side)}));
  const mx=Math.max(...scored.map(x=>x.n));
  return scored.filter(x=>x.n===mx).map(x=>x.m);
}
function legalMoves(board,side,fromOnly=null){
  const caps=rawMoves(board,side,null,true);
  if(caps.length){
    const best=maxCaptureOnly(board,side,caps);
    return fromOnly?best.filter(m=>m.from.r===fromOnly.r&&m.from.c===fromOnly.c):best;
  }
  return rawMoves(board,side,fromOnly,false);
}
function bestFollow(board,side,from){
  const caps=rawMoves(board,side,from,true);
  return caps.length?maxCaptureOnly(board,side,caps):[];
}
function applyStep(board,move,side){
  const b=clone(board),p=b[move.from.r][move.from.c];
  b[move.from.r][move.from.c]=null;
  move.captured.forEach(s=>b[s.r][s.c]=null);
  const landed={...p};
  if((side==="white"&&move.to.r===0)||(side==="black"&&move.to.r===7)) landed.king=true;
  b[move.to.r][move.to.c]=landed;
  return b;
}
function completeTurns(board,side){
  const out=[];
  function extend(b,m,path){
    const next=applyStep(b,m,side),steps=[...path,m];
    if(m.captured.length){
      const follow=rawMoves(next,side,m.to,true);
      if(follow.length){follow.forEach(x=>extend(next,x,steps));return;}
    }
    out.push({steps,board:next,captures:steps.reduce((n,x)=>n+x.captured.length,0)});
  }
  const caps=rawMoves(board,side,null,true);
  (caps.length?caps:rawMoves(board,side)).forEach(m=>extend(board,m,[]));
  if(!out.length) return out;
  const mx=Math.max(...out.map(t=>t.captures));
  return out.filter(t=>t.captures===mx);
}
const DRAW_LIMIT=100;
const stepIsProgress=(b,m)=>m.captured.length>0||(!b[m.from.r][m.from.c].king&&m.to.r!==m.from.r);
function evaluate(board){
  let score=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=board[r][c];if(!p)continue;
    let v=p.king?8:3;
    if(!p.king)v+=p.side==="black"?r*.08:(7-r)*.08;
    score+=p.side==="black"?v:-v;
  }
  return score;
}
const levelConfig={
  "Çaylak":{depth:1,noise:3.8,blunder:.38},
  "Acemi":{depth:2,noise:2.2,blunder:.25},
  "Usta":{depth:3,noise:1.1,blunder:.14},
  "Şampiyon":{depth:4,noise:.45,blunder:.06},
  "Efsane":{depth:5,noise:.08,blunder:.015}
};
function minimax(board,side,depth,alpha,beta){
  const turns=completeTurns(board,side);
  if(!turns.length)return side==="black"?-10000-depth:10000+depth;
  if(depth<=0)return evaluate(board);
  turns.sort((a,b)=>side==="black"?evaluate(b.board)-evaluate(a.board):evaluate(a.board)-evaluate(b.board));
  if(side==="black"){
    let best=-Infinity;
    for(const t of turns){best=Math.max(best,minimax(t.board,"white",depth-1,alpha,beta));alpha=Math.max(alpha,best);if(beta<=alpha)break;}
    return best;
  }
  let best=Infinity;
  for(const t of turns){best=Math.min(best,minimax(t.board,"black",depth-1,alpha,beta));beta=Math.min(beta,best);if(beta<=alpha)break;}
  return best;
}
function aiChoose(board,difficulty){
  const cfg=levelConfig[difficulty]||levelConfig.Usta,turns=completeTurns(board,"black");
  if(!turns.length)return null;
  const ranked=turns.map(t=>({turn:t,score:minimax(t.board,"white",cfg.depth-1,-Infinity,Infinity)+t.captures*.15+(Math.random()-.5)*cfg.noise})).sort((a,b)=>b.score-a.score);
  if(Math.random()<cfg.blunder&&ranked.length>1){
    const pool=ranked.slice(0,Math.min(ranked.length,difficulty==="Çaylak"?ranked.length:3));
    return pool[Math.floor(Math.random()*pool.length)].turn;
  }
  return ranked[0].turn;
}

// ---------- SES EFEKTLERİ (dosya yok, kod ile üretiliyor) ----------
const SR=22050;
const B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes){
  let out="";
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i],hasB=i+1<bytes.length,hasC=i+2<bytes.length,b=hasB?bytes[i+1]:0,c=hasC?bytes[i+2]:0;
    out+=B64[a>>2]+B64[((a&3)<<4)|(b>>4)]+(hasB?B64[((b&15)<<2)|(c>>6)]:"=")+(hasC?B64[c&63]:"=");
  }
  return out;
}
function synthWav(parts,total){
  const n=Math.floor(total*SR),buf=new Float32Array(n);
  for(const p of parts){
    const s0=Math.floor(p.t0*SR),len=Math.floor(p.dur*SR);
    let ph=0,lp=0;
    for(let i=0;i<len&&s0+i<n;i++){
      const t=i/len;
      let v;
      if(p.noise){lp+=(Math.random()*2-1-lp)*p.cut;v=lp*1.8;}
      else{
        ph+=2*Math.PI*(p.f0+(p.f1-p.f0)*t)/SR;
        v=p.type==="tri"?(2/Math.PI)*Math.asin(Math.sin(ph)):Math.sin(ph);
      }
      buf[s0+i]+=v*Math.min(1,i/(SR*.004))*Math.pow(1-t,p.curve||2)*p.vol;
    }
  }
  const bytes=new Uint8Array(44+n*2),dv=new DataView(bytes.buffer);
  const wr=(o,t)=>{for(let i=0;i<t.length;i++)bytes[o+i]=t.charCodeAt(i);};
  wr(0,"RIFF");dv.setUint32(4,36+n*2,true);wr(8,"WAVE");wr(12,"fmt ");
  dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,SR,true);dv.setUint32(28,SR*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);
  wr(36,"data");dv.setUint32(40,n*2,true);
  for(let i=0;i<n;i++) dv.setInt16(44+i*2,Math.max(-1,Math.min(1,buf[i]))*32767,true);
  return "data:audio/wav;base64,"+bytesToBase64(bytes);
}
const tone=(t0,f,dur,vol=.28,curve=2)=>({t0,f0:f,f1:f,dur,vol,type:"tri",curve});
const SOUND_DEFS={
  select:{total:.1,parts:[{t0:0,f0:900,f1:700,dur:.06,vol:.22,curve:3}]},
  move:{total:.2,parts:[{noise:1,cut:.22,t0:0,dur:.07,vol:.55,curve:4},{t0:0,f0:260,f1:130,dur:.14,vol:.45,curve:3}]},
  capture:{total:.35,parts:[
    {noise:1,cut:.5,t0:0,dur:.09,vol:.55,curve:3},{t0:0,f0:210,f1:90,dur:.2,vol:.5,curve:3},
    {noise:1,cut:.3,t0:.08,dur:.07,vol:.5,curve:3},{t0:.08,f0:430,f1:300,dur:.12,vol:.3,curve:3}]},
  king:{total:.6,parts:[523,659,784,1047].map((f,i)=>tone(i*.08,f,.28))},
  win:{total:1.4,parts:[tone(0,523,.35,.28,1.5),tone(.15,659,.35,.28,1.5),tone(.3,784,.35,.28,1.5),
    tone(.45,1047,.9,.3,1.5),tone(.45,784,.9,.2,1.5),tone(.45,523,.9,.2,1.5),tone(.8,1568,.4,.15,2)]},
  lose:{total:1.1,parts:[tone(0,392,.3,.3),tone(.25,330,.3,.3),tone(.5,262,.6,.3)]},
  draw:{total:.9,parts:[tone(0,392,.35),tone(.3,392,.5)]}
};
const soundUris={},nativePlayers={};
let audioModeSet=false;
function playSfx(name){
  try{
    if(!soundUris[name]) soundUris[name]=synthWav(SOUND_DEFS[name].parts,SOUND_DEFS[name].total);
    const uri=soundUris[name];
    if(Platform.OS==="web"){
      if(typeof Audio==="undefined") return;
      const a=new Audio(uri);a.volume=.9;
      const pr=a.play();if(pr&&pr.catch) pr.catch(()=>{});
      return;
    }
    const audio=require("expo-audio");
    if(!audioModeSet){audioModeSet=true;try{audio.setAudioModeAsync({playsInSilentMode:true});}catch(e){}}
    let pl=nativePlayers[name];
    if(!pl){pl=audio.createAudioPlayer({uri});nativePlayers[name]=pl;}
    pl.seekTo(0);pl.play();
  }catch(e){}
}

const LIGHT_SHADES=["#dfc08e","#e3c695","#d9ba88","#e6cb9a"];
const DARK_SHADES=["#74492a","#7c5130","#6e4426","#82552f"];
const CONFETTI=["#ffd86b","#ff6b6b","#6bd6ff","#9bff8f","#ff9bf0","#ffffff"];
function Piece({side,king,selected,glow,full}){
  const white=side==="white";
  return <View style={[styles.piece,full&&styles.pieceFull,white?styles.whitePiece:styles.blackPiece,king&&styles.kingPiece,selected&&styles.pieceSelected]}>
    <View style={[styles.pieceInner,white?styles.whiteInner:styles.blackInner,king&&styles.kingInner]}/>
    <View style={[styles.pieceShine,white?styles.whiteShine:styles.blackShine]}/>
    {king&&<Text style={[styles.crown,white?styles.whiteCrown:styles.blackCrown]}>♛</Text>}
    {glow&&<Animated.View pointerEvents="none" style={[styles.winRing,{opacity:glow}]}/>}
  </View>;
}
function Confetti({w,h}){
  const parts=useRef(Array.from({length:34},(_,i)=>({
    x:Math.random()*Math.max(w-10,1),size:5+Math.random()*7,delay:Math.random()*1600,dur:2200+Math.random()*1800,
    color:CONFETTI[i%CONFETTI.length],spin:Math.random()>.5?1:-1,v:new Animated.Value(0)
  }))).current;
  useEffect(()=>{
    const anims=parts.map(p=>Animated.loop(Animated.timing(p.v,{toValue:1,duration:p.dur,delay:p.delay,easing:Easing.linear,useNativeDriver:true})));
    anims.forEach(a=>a.start());
    return()=>anims.forEach(a=>a.stop());
  },[]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{parts.map((p,i)=>
    <Animated.View key={i} style={{position:"absolute",left:p.x,top:-20,width:p.size,height:p.size*1.6,backgroundColor:p.color,borderRadius:2,
      transform:[
        {translateY:p.v.interpolate({inputRange:[0,1],outputRange:[0,h+40]})},
        {translateX:p.v.interpolate({inputRange:[0,.5,1],outputRange:[0,14*p.spin,-14*p.spin]})},
        {rotate:p.v.interpolate({inputRange:[0,1],outputRange:["0deg",(p.spin*720)+"deg"]})}
      ]}}/>)}</View>;
}
function ResultBanner({result,onAgain}){
  const pop=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.spring(pop,{toValue:1,friction:5,tension:70,useNativeDriver:true}).start();},[]);
  return <View pointerEvents="box-none" style={styles.bannerWrap}>
    <Animated.View style={[styles.banner,result.party&&styles.bannerWin,{opacity:pop,transform:[{scale:pop.interpolate({inputRange:[0,1],outputRange:[.4,1]})}]}]}>
      <Text style={styles.bannerEmoji}>{result.emoji}</Text>
      <Text style={styles.bannerTitle}>{result.title}</Text>
      {!!result.sub&&<Text style={styles.bannerSub}>{result.sub}</Text>}
      <Pressable onPress={onAgain} style={styles.bannerBtn}><Text style={styles.bannerBtnText}>↻ Tekrar Oyna</Text></Pressable>
    </Animated.View>
  </View>;
}

export default function App(){
  const [board,setBoard]=useState(initialBoard);
  const [selected,setSelected]=useState(null);
  const [legal,setLegal]=useState([]);
  const [turn,setTurn]=useState("white");
  const [difficulty,setDifficulty]=useState("Usta");
  const [mode,setMode]=useState("ai");
  const [movesCount,setMovesCount]=useState(0);
  const [status,setStatus]=useState("Sıra sende. İlk hamleni yap!");
  const [busy,setBusy]=useState(false);
  const [chainActive,setChainActive]=useState(false);
  const [gameOver,setGameOver]=useState(false);
  const [result,setResult]=useState(null);
  const [lastMove,setLastMove]=useState(null);
  const [soundOn,setSoundOn]=useState(true);
  const soundRef=useRef(true);
  const sfx=n=>{if(soundRef.current) playSfx(n);};
  function toggleSound(){const next=!soundOn;soundRef.current=next;setSoundOn(next);if(next) playSfx("select");}
  const [animating,setAnimating]=useState(null);
  const [boardWidth,setBoardWidth]=useState(0);
  const progress=useRef(new Animated.Value(0)).current;
  const animationLock=useRef(false);
  const quietRef=useRef(0);
  const turnProgress=useRef(false);
  const pulse=useRef(new Animated.Value(0)).current;
  const whiteCount=useMemo(()=>countPieces(board,"white"),[board]);
  const blackCount=useMemo(()=>countPieces(board,"black"),[board]);
  const cell=Math.max(0,(boardWidth-4)/8);
  const pvp=mode==="pvp";
  useEffect(()=>{
    if(!result||!result.party){pulse.setValue(0);return;}
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:700,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
      Animated.timing(pulse,{toValue:.2,duration:700,easing:Easing.inOut(Easing.quad),useNativeDriver:true})
    ]));
    loop.start();
    return()=>loop.stop();
  },[result]);
  useEffect(()=>{
    if(result) sfx(result.winner===null?"draw":result.party?"win":"lose");
  },[result]);
  function winResult(winner){
    if(pvp) return {winner,party:true,emoji:"🏆",title:winner==="white"?"BEYAZ KAZANDI!":"SİYAH KAZANDI!",sub:"Tebrikler, harika bir oyundu!"};
    return winner==="white"
      ?{winner,party:true,emoji:"🏆",title:"TEBRİKLER, KAZANDIN!",sub:"Yapay zekâyı yendin."}
      :{winner,party:false,emoji:"🤖",title:"YAPAY ZEKÂ KAZANDI",sub:"Rövanş için tekrar oyna!"};
  }
  const drawResult={winner:null,party:false,emoji:"🤝",title:"BERABERE",sub:"Kimse kazanamadı."};
  
  function reset(m=mode){
    animationLock.current=false;quietRef.current=0;turnProgress.current=false;
    setAnimating(null);progress.stopAnimation();progress.setValue(0);
    setBoard(initialBoard());setSelected(null);setLegal([]);setTurn("white");setMovesCount(0);
    setBusy(false);setChainActive(false);setGameOver(false);setResult(null);setLastMove(null);
    setStatus(m==="pvp"?"2 kişilik oyun. Beyaz başlar, sıra Beyazda!":"Sıra sende. İlk hamleni yap!");
  }
  function switchMode(m){
    if(m===mode||busy||animationLock.current) return;
    setMode(m);reset(m);
  }
  function finishCheck(b){
    if(!countPieces(b,"white")||!legalMoves(b,"white").length){setStatus(pvp?"Oyun bitti. Siyah kazandı! 🎉":"Oyun bitti. Yapay zekâ kazandı!");setResult(winResult("black"));setGameOver(true);return true;}
    if(!countPieces(b,"black")||!legalMoves(b,"black").length){setStatus(pvp?"Oyun bitti. Beyaz kazandı! 🎉":"Tebrikler! Oyunu kazandın!");setResult(winResult("white"));setGameOver(true);return true;}
    const wp=b.flat().filter(p=>p&&p.side==="white"),bp=b.flat().filter(p=>p&&p.side==="black");
    if(wp.length===1&&bp.length===1&&wp[0].king&&bp[0].king&&!rawMoves(b,"white",null,true).length&&!rawMoves(b,"black",null,true).length){
      setStatus("Berabere! Bir vezir bir vezire karşı kaldı, kimse kazanamaz.");setResult(drawResult);setGameOver(true);return true;
    }
    if(quietRef.current>=DRAW_LIMIT){setStatus("Berabere! Uzun süredir taş alınmadı ve ilerleme olmadı.");setResult(drawResult);setGameOver(true);return true;}
    return false;
  }

  function animateStep(currentBoard,move,side){
    return new Promise(resolve=>{
      const piece=currentBoard[move.from.r][move.from.c];
      if(!piece||!cell){resolve(applyStep(currentBoard,move,side));return;}
      animationLock.current=true;progress.stopAnimation();progress.setValue(0);
      setLastMove({from:move.from,to:move.to});
      setAnimating({from:move.from,to:move.to,piece});
      Animated.timing(progress,{
        toValue:1,duration:560,easing:Easing.inOut(Easing.cubic),useNativeDriver:true
      }).start(()=>{
        const next=applyStep(currentBoard,move,side);
        setBoard(next);setAnimating(null);animationLock.current=false;
        sfx(move.captured.length?"capture":"move");
        const landed=next[move.to.r][move.to.c];
        if(landed&&landed.king&&!piece.king) setTimeout(()=>sfx("king"),180);
        resolve(next);
      });
    });
  }
  async function animateSequence(startBoard,steps,side){
    let current=startBoard;
    for(let i=0;i<steps.length;i++){
      current=await animateStep(current,steps[i],side);
      if(i<steps.length-1) await new Promise(r=>setTimeout(r,180));
    }
    return current;
  }

  async function runAI(b){
    setBusy(true);setStatus("Yapay zekâ hamlesini hesaplıyor...");
    await new Promise(r=>setTimeout(r,500));
    const chosen=aiChoose(b,difficulty);
    if(!chosen){setStatus("Tebrikler! Oyunu kazandın!");setResult(winResult("white"));setGameOver(true);setBusy(false);return;}
    let next=b;
    for(let i=0;i<chosen.steps.length;i++){
      const step=chosen.steps[i];
      setStatus(step.captured.length?"Rakip taş alıyor...":"Rakip hamle yapıyor...");
      next=await animateStep(next,step,"black");
      if(i<chosen.steps.length-1) await new Promise(r=>setTimeout(r,220));
    }
    setMovesCount(n=>n+1);
    quietRef.current=(stepIsProgress(b,chosen.steps[0])||chosen.captures>0)?0:quietRef.current+1;
    if(!finishCheck(next)){setTurn("white");setStatus(chosen.captures>1?"Rakip çoklu taş aldı. Sıra sende!":chosen.captures===1?"Rakip taş aldı. Sıra sende!":"Rakip hamlesini yaptı. Sıra sende!");}
    setBusy(false);
  }

  async function tapSquare(r,c){
    if((!pvp&&turn!=="white")||busy||gameOver||animationLock.current)return;
    const piece=board[r][c],target=legal.find(m=>m.to.r===r&&m.to.c===c);
    if(selected&&target){
      if(stepIsProgress(board,target)) turnProgress.current=true;
      const next=await animateStep(board,target,turn);
      const more=target.captured.length?bestFollow(next,turn,target.to):[];
      if(more.length){
        setSelected(target.to);setLegal(more);setChainActive(true);
        setStatus("Güzel! Aynı taşla almaya devam et. Başka taş seçemezsin.");
        return;
      }
      setSelected(null);setLegal([]);setChainActive(false);setMovesCount(n=>n+1);
      quietRef.current=turnProgress.current?0:quietRef.current+1;turnProgress.current=false;
      if(!finishCheck(next)){
        if(pvp){const nt=turn==="white"?"black":"white";setTurn(nt);setStatus("Sıra "+(nt==="white"?"Beyazda":"Siyahta")+". Telefonu rakibine ver!");}
        else{setTurn("black");runAI(next);}
      }
      return;
    }
    if(piece&&piece.side===turn&&!chainActive){
      const moves=legalMoves(board,turn,{r,c}).filter(m=>m.from.r===r&&m.from.c===c);
      sfx("select");setSelected({r,c});setLegal(moves);
      setStatus(moves.some(m=>m.captured.length)?"Taş alma zorunlu. Parlayan karelerden birini seç.":"Taşını hareket ettireceğin kareyi seç.");
    }else if(!chainActive){setSelected(null);setLegal([]);}
  }

  const levels=["Çaylak","Acemi","Usta","Şampiyon","Efsane"];
  const movingStyle=animating?{
    position:"absolute",left:animating.from.c*cell+cell*.12,top:animating.from.r*cell+cell*.12,
    width:cell*.76,height:cell*.76,zIndex:20
  }:null;
  const translateX=animating?progress.interpolate({inputRange:[0,1],outputRange:[0,(animating.to.c-animating.from.c)*cell]}):0;
  const translateY=animating?progress.interpolate({inputRange:[0,1],outputRange:[0,(animating.to.r-animating.from.r)*cell]}):0;

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content"/>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>STRATEJİ • ZEKA • SABIR</Text><Text style={styles.title}>TÜRK DAMASI</Text></View>
        <View style={styles.headerBtns}>
          <Pressable onPress={toggleSound} style={styles.soundButton}><Text style={styles.soundText}>{soundOn?"🔊":"🔇"}</Text></Pressable>
          <Pressable onPress={()=>reset()} style={styles.newButton}><Text style={styles.newButtonText}>↻ Yeni Oyun</Text></Pressable>
        </View>
      </View>
      <View style={styles.hero}>
        <View style={styles.modeRow}>
          <Pressable onPress={()=>switchMode("ai")} style={[styles.modeBtn,!pvp&&styles.levelActive]}><Text style={[styles.levelText,!pvp&&styles.levelTextActive]}>🤖 Yapay Zekâ</Text></Pressable>
          <Pressable onPress={()=>switchMode("pvp")} style={[styles.modeBtn,pvp&&styles.levelActive]}><Text style={[styles.levelText,pvp&&styles.levelTextActive]}>👥 2 Kişi</Text></Pressable>
        </View>
        {pvp?<View><Text style={styles.heroLabel}>MOD</Text><Text style={styles.heroName}>👥 İki Kişilik Oyun</Text><Text style={styles.levelHint}>Aynı telefonda sırayla oynayın. Beyaz alttan başlar.</Text></View>:<>
        <View><Text style={styles.heroLabel}>RAKİBİN</Text><Text style={styles.heroName}>🤖 Yapay Zekâ</Text></View>
        <View style={styles.levelWrap}>{levels.map(l=><Pressable key={l} onPress={()=>{if(!busy&&turn==="white"&&!chainActive){setDifficulty(l);setStatus("Zorluk "+l+" seçildi.");}}} style={[styles.level,difficulty===l&&styles.levelActive]}><Text style={[styles.levelText,difficulty===l&&styles.levelTextActive]}>{l}</Text></Pressable>)}</View>
        <Text style={styles.levelHint}>Seviye: {difficulty} • {levelConfig[difficulty].depth} hamle derinliğinde analiz</Text>
        </>}
      </View>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCard}><Text style={styles.scoreLabel}>{pvp?"OYUNCU 1 • BEYAZ":"SEN • BEYAZ"}</Text><Text style={styles.scoreNumber}>{whiteCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
        <View style={styles.turnPill}><Text style={styles.turnText}>{pvp?(turn==="white"?"SIRA BEYAZDA":"SIRA SİYAHTA"):busy?"RAKİP DÜŞÜNÜYOR":turn==="white"?"SIRA SENDE":"RAKİPTE"}</Text><Text style={styles.turnDot}>●</Text></View>
        <View style={styles.scoreCard}><Text style={styles.scoreLabel}>{pvp?"OYUNCU 2 • SİYAH":"YAPAY ZEKÂ • SİYAH"}</Text><Text style={styles.scoreNumber}>{blackCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
      </View>
      <View style={styles.boardOuter}>
        <View style={styles.boardRow}>
        <View style={styles.board} onLayout={e=>setBoardWidth(e.nativeEvent.layout.width)}>
          {board.map((row,r)=><View key={r} style={styles.row}>{row.map((piece,c)=>{
            const isLight=(r+c)%2===0,isSelected=selected?.r===r&&selected?.c===c;
            const legalMove=legal.find(m=>m.to.r===r&&m.to.c===c),isLegal=!!legalMove;
            const isLast=lastMove&&((lastMove.from.r===r&&lastMove.from.c===c)||(lastMove.to.r===r&&lastMove.to.c===c));
            const shade=(isLight?LIGHT_SHADES:DARK_SHADES)[(r*3+c*5)%4];
            const isMovingSource=animating?.from.r===r&&animating?.from.c===c;
            return <Pressable key={c} onPress={()=>tapSquare(r,c)} style={[styles.square,{backgroundColor:shade},isSelected&&styles.selectedSquare,isLegal&&styles.legalSquare]}>
              {isLast&&<View pointerEvents="none" style={styles.lastOverlay}/>}
              {piece&&!isMovingSource&&<Piece side={piece.side} king={piece.king} selected={isSelected} glow={result&&result.party&&result.winner===piece.side?pulse:null}/>}
              {isLegal&&!piece&&<View style={[styles.moveDot,legalMove.captured.length>0&&styles.captureDot]}/>}
            </Pressable>;
          })}</View>)}
          {animating&&cell>0&&<Animated.View pointerEvents="none" style={[movingStyle,{transform:[{translateX},{translateY}]}]}>
            <View style={styles.animatedWrap}><Piece full side={animating.piece.side} king={animating.piece.king}/></View>
          </Animated.View>}
          {result&&result.party&&boardWidth>0&&<Confetti key={"c"+movesCount} w={boardWidth} h={boardWidth}/>}
          {result&&<ResultBanner key={"b"+movesCount} result={result} onAgain={()=>reset()}/>}
        </View>
        </View>
      </View>
      <View style={styles.statusBox}><Text style={styles.statusIcon}>✦</Text><Text style={styles.statusText}>{status}</Text></View>
      <View style={styles.infoRow}>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>TURLAR</Text><Text style={styles.infoValue}>{movesCount}</Text></View>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>ZORUNLU ALMA</Text><Text style={styles.infoValue}>Açık</Text></View>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>TAHTA</Text><Text style={styles.infoValue}>8 × 8</Text></View>
      </View>
      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>NASIL OYNANIR?</Text>
        <Text style={styles.ruleText}>• Yapay zekâya karşı beyaz taşlarla sen oynarsın; 2 kişi modunda telefonu sırayla verirsiniz, Beyaz başlar. Taşlar ileri ve yana bir kare gider.</Text>
        <Text style={styles.ruleText}>• Rakip taşın üzerinden ileri veya yana atlayarak taş alırsın (geri alma sadece vezirde). Taş alma zorunludur.</Text>
        <Text style={styles.ruleText}>• Birden fazla alma yolu varsa en çok taş alan yolu seçmek zorundasın.</Text>
        <Text style={styles.ruleText}>• Bir taş aldıktan sonra aynı taşla başka alma imkânı varsa devam etmelisin.</Text>
        <Text style={styles.ruleText}>• Son sıraya ulaşan taş vezir olur ve yatay/dikey istediği kadar ilerler.</Text>
        <Text style={styles.ruleText}>• Rakibin tüm taşlarını al veya hamlesiz bırak.</Text>
        <Text style={styles.ruleText}>• 100 hamle boyunca taş alınmaz ve hiçbir taş ileri gitmezse oyun berabere biter.</Text>
      </View>
      <Text style={styles.footer}>BAĞIMSIZ TÜRK DAMASI • AKICI HAMLE ANİMASYONU</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#101d19"},container:{padding:16,paddingBottom:36},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:18},
  eyebrow:{fontSize:9,letterSpacing:3,color:"#c8a65b",fontWeight:"800"},
  title:{fontSize:25,fontWeight:"900",letterSpacing:1.5,color:"#f4ead5",marginTop:4},
  headerBtns:{flexDirection:"row",alignItems:"center",gap:8},
  soundButton:{backgroundColor:"#263b31",borderWidth:1,borderColor:"#3c5143",paddingVertical:8,paddingHorizontal:11,borderRadius:12},
  soundText:{fontSize:16},
  newButton:{backgroundColor:"#c49b4a",paddingVertical:10,paddingHorizontal:13,borderRadius:12},
  newButtonText:{color:"#17231d",fontWeight:"900",fontSize:12},
  hero:{backgroundColor:"#1a2c25",borderColor:"#344a3d",borderWidth:1,borderRadius:16,padding:14,marginBottom:14},
  heroLabel:{color:"#a9b5a8",fontSize:9,letterSpacing:2,fontWeight:"800"},
  heroName:{color:"#f6edda",fontSize:17,fontWeight:"800",marginTop:4},
  modeRow:{flexDirection:"row",gap:8,marginBottom:12},
  modeBtn:{flex:1,alignItems:"center",paddingVertical:9,borderRadius:10,backgroundColor:"#263b31",borderWidth:1,borderColor:"#3c5143"},
  levelWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:12},
  level:{paddingVertical:7,paddingHorizontal:10,borderRadius:9,backgroundColor:"#263b31",borderWidth:1,borderColor:"#3c5143"},
  levelActive:{backgroundColor:"#c49b4a",borderColor:"#e4c77f"},
  levelText:{fontSize:10,color:"#d2d9cd",fontWeight:"700"},levelTextActive:{color:"#17231d"},
  levelHint:{color:"#c8d0c3",fontSize:10,marginTop:8},
  scoreRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  scoreCard:{backgroundColor:"#1a2c25",borderRadius:13,padding:10,minWidth:95,alignItems:"center",borderWidth:1,borderColor:"#344a3d"},
  scoreLabel:{fontSize:8,color:"#c5b27e",fontWeight:"800",letterSpacing:1},
  scoreNumber:{fontSize:25,color:"#f5ecd9",fontWeight:"900",marginTop:2},
  scoreSub:{fontSize:9,color:"#a9b5a8"},turnPill:{alignItems:"center",gap:4},
  turnText:{fontSize:8,color:"#e4c77f",fontWeight:"900",letterSpacing:1},turnDot:{color:"#d4ad5d",fontSize:12},
  boardOuter:{backgroundColor:"#3a2818",padding:10,paddingTop:12,borderRadius:20,borderWidth:3,borderColor:"#b98a42",shadowColor:"#000",shadowOpacity:.45,shadowRadius:16,shadowOffset:{width:0,height:6},elevation:10},
  boardRow:{flexDirection:"row"},
  lastOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(255,214,102,.30)"},
  board:{flex:1,borderWidth:2,borderColor:"#c49b4a",position:"relative",overflow:"hidden",borderRadius:4},
  row:{flexDirection:"row"},square:{width:"12.5%",aspectRatio:1,alignItems:"center",justifyContent:"center",borderWidth:.6,borderTopColor:"rgba(255,255,255,.14)",borderLeftColor:"rgba(255,255,255,.10)",borderBottomColor:"rgba(0,0,0,.18)",borderRightColor:"rgba(0,0,0,.14)"},
  selectedSquare:{backgroundColor:"#d9b04c"},legalSquare:{backgroundColor:"#8fa86f"},
  piece:{width:"76%",height:"76%",borderRadius:100,alignItems:"center",justifyContent:"center",borderWidth:2,shadowColor:"#000",shadowOpacity:.55,shadowRadius:4,shadowOffset:{width:0,height:3},elevation:6},
  pieceFull:{width:"100%",height:"100%"},
  animatedWrap:{width:"100%",height:"100%",alignItems:"center",justifyContent:"center"},
  whitePiece:{backgroundColor:"#e6d7b6",borderColor:"#a38f64"},
  blackPiece:{backgroundColor:"#161a18",borderColor:"#050706"},
  pieceInner:{position:"absolute",width:"68%",height:"68%",borderRadius:100,borderWidth:1.5},
  whiteInner:{backgroundColor:"#f7eed9",borderColor:"#c9b78d"},
  blackInner:{backgroundColor:"#262c29",borderColor:"#47514b"},
  kingPiece:{borderColor:"#d8ad4c",shadowColor:"#f0c040",shadowOpacity:.9,shadowRadius:7},
  kingInner:{borderColor:"#d8ad4c",borderWidth:2},
  pieceShine:{position:"absolute",top:"11%",left:"17%",width:"28%",height:"13%",borderRadius:20,transform:[{rotate:"-28deg"}]},
  whiteShine:{backgroundColor:"#fffdf5"},blackShine:{backgroundColor:"#7a867f"},
  pieceSelected:{borderColor:"#f7d66d",borderWidth:3,shadowColor:"#f7d66d",shadowOpacity:1,shadowRadius:8},
  crown:{fontSize:20,fontWeight:"900",textShadowColor:"rgba(240,192,64,.8)",textShadowRadius:6,textShadowOffset:{width:0,height:0}},
  whiteCrown:{color:"#a87818"},blackCrown:{color:"#f0c850"},
  winRing:{position:"absolute",top:-5,left:-5,right:-5,bottom:-5,borderRadius:100,borderWidth:3,borderColor:"#ffd86b",shadowColor:"#ffd86b",shadowOpacity:1,shadowRadius:10},
  bannerWrap:{...StyleSheet.absoluteFillObject,alignItems:"center",justifyContent:"center"},
  banner:{backgroundColor:"rgba(16,29,25,.93)",borderRadius:20,borderWidth:2,borderColor:"#7d8f7f",paddingVertical:18,paddingHorizontal:26,alignItems:"center",maxWidth:"88%"},
  bannerWin:{borderColor:"#ffd86b",shadowColor:"#ffd86b",shadowOpacity:.9,shadowRadius:18,elevation:12},
  bannerEmoji:{fontSize:42},
  bannerTitle:{color:"#ffe9a8",fontSize:21,fontWeight:"900",letterSpacing:1,marginTop:4,textAlign:"center"},
  bannerSub:{color:"#d3d9ce",fontSize:12,marginTop:4,textAlign:"center"},
  bannerBtn:{marginTop:14,backgroundColor:"#c49b4a",paddingVertical:10,paddingHorizontal:18,borderRadius:12},
  bannerBtnText:{color:"#17231d",fontWeight:"900",fontSize:13},
  moveDot:{width:12,height:12,borderRadius:12,backgroundColor:"#f3f7dc",borderWidth:2,borderColor:"#4f6a38",shadowColor:"#fff",shadowOpacity:.9,shadowRadius:5},
  captureDot:{backgroundColor:"#ffb3a6",borderColor:"#a8321f",shadowColor:"#ff6b4a"},
  statusBox:{marginTop:14,backgroundColor:"#24372d",borderColor:"#49634d",borderWidth:1,borderRadius:13,padding:13,flexDirection:"row",alignItems:"center",gap:9},
  statusIcon:{color:"#e0bd69",fontSize:18},statusText:{color:"#f3ead7",fontWeight:"700",fontSize:12,flex:1},
  infoRow:{flexDirection:"row",gap:8,marginTop:12},
  infoCard:{flex:1,backgroundColor:"#1a2c25",borderRadius:12,padding:10,borderWidth:1,borderColor:"#344a3d"},
  infoTitle:{fontSize:8,color:"#aeb9aa",fontWeight:"800",letterSpacing:.5},infoValue:{fontSize:15,color:"#e5c477",fontWeight:"900",marginTop:5},
  rules:{marginTop:17,backgroundColor:"#172720",borderRadius:14,padding:14,borderWidth:1,borderColor:"#2e4438"},
  rulesTitle:{color:"#e2bd69",fontWeight:"900",fontSize:11,letterSpacing:1.5,marginBottom:8},
  ruleText:{color:"#d3d9ce",fontSize:11,lineHeight:19,marginBottom:3},
  footer:{textAlign:"center",fontSize:8,color:"#718477",letterSpacing:1.2,marginTop:18}
});
