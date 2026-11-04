import React, { useMemo, useState, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, Animated, Easing, useWindowDimensions
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

export default function App(){
  const [board,setBoard]=useState(initialBoard);
  const [selected,setSelected]=useState(null);
  const [legal,setLegal]=useState([]);
  const [turn,setTurn]=useState("white");
  const [difficulty,setDifficulty]=useState("Usta");
  const [movesCount,setMovesCount]=useState(0);
  const [status,setStatus]=useState("Sıra sende. İlk hamleni yap!");
  const [busy,setBusy]=useState(false);
  const [chainActive,setChainActive]=useState(false);
  const [gameOver,setGameOver]=useState(false);
  const [animating,setAnimating]=useState(null);
  const [boardWidth,setBoardWidth]=useState(0);
  const progress=useRef(new Animated.Value(0)).current;
  const animationLock=useRef(false);
  const quietRef=useRef(0);
  const turnProgress=useRef(false);
  const whiteCount=useMemo(()=>countPieces(board,"white"),[board]);
  const blackCount=useMemo(()=>countPieces(board,"black"),[board]);
  const cell=boardWidth/8;

  function reset(){
    animationLock.current=false;quietRef.current=0;turnProgress.current=false;
    setAnimating(null);progress.stopAnimation();progress.setValue(0);
    setBoard(initialBoard());setSelected(null);setLegal([]);setTurn("white");setMovesCount(0);
    setBusy(false);setChainActive(false);setGameOver(false);setStatus("Sıra sende. İlk hamleni yap!");
  }
  function finishCheck(b){
    if(!countPieces(b,"white")||!legalMoves(b,"white").length){setStatus("Oyun bitti. Yapay zekâ kazandı!");setGameOver(true);return true;}
    if(!countPieces(b,"black")||!legalMoves(b,"black").length){setStatus("Tebrikler! Oyunu kazandın!");setGameOver(true);return true;}
    const wp=b.flat().filter(p=>p&&p.side==="white"),bp=b.flat().filter(p=>p&&p.side==="black");
    if(wp.length===1&&bp.length===1&&wp[0].king&&bp[0].king&&!rawMoves(b,"white",null,true).length&&!rawMoves(b,"black",null,true).length){
      setStatus("Berabere! Bir vezir bir vezire karşı kaldı, kimse kazanamaz.");setGameOver(true);return true;
    }
    if(quietRef.current>=DRAW_LIMIT){setStatus("Berabere! Uzun süredir taş alınmadı ve ilerleme olmadı.");setGameOver(true);return true;}
    return false;
  }

  function animateStep(currentBoard,move,side){
    return new Promise(resolve=>{
      const piece=currentBoard[move.from.r][move.from.c];
      if(!piece||!cell){resolve(applyStep(currentBoard,move,side));return;}
      animationLock.current=true;progress.stopAnimation();progress.setValue(0);
      setAnimating({from:move.from,to:move.to,piece});
      Animated.timing(progress,{
        toValue:1,duration:560,easing:Easing.inOut(Easing.cubic),useNativeDriver:true
      }).start(()=>{
        const next=applyStep(currentBoard,move,side);
        setBoard(next);setAnimating(null);animationLock.current=false;
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
    if(!chosen){setStatus("Tebrikler! Oyunu kazandın!");setGameOver(true);setBusy(false);return;}
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
    if(turn!=="white"||busy||gameOver||animationLock.current)return;
    const piece=board[r][c],target=legal.find(m=>m.to.r===r&&m.to.c===c);
    if(selected&&target){
      if(stepIsProgress(board,target)) turnProgress.current=true;
      const next=await animateStep(board,target,"white");
      const more=target.captured.length?bestFollow(next,"white",target.to):[];
      if(more.length){
        setSelected(target.to);setLegal(more);setChainActive(true);
        setStatus("Güzel! Aynı taşla almaya devam et. Başka taş seçemezsin.");
        return;
      }
      setSelected(null);setLegal([]);setChainActive(false);setMovesCount(n=>n+1);
      quietRef.current=turnProgress.current?0:quietRef.current+1;turnProgress.current=false;
      if(!finishCheck(next)){setTurn("black");runAI(next);}
      return;
    }
    if(piece&&piece.side==="white"&&!chainActive){
      const moves=legalMoves(board,"white",{r,c}).filter(m=>m.from.r===r&&m.from.c===c);
      setSelected({r,c});setLegal(moves);
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
        <Pressable onPress={reset} style={styles.newButton}><Text style={styles.newButtonText}>↻ Yeni Oyun</Text></Pressable>
      </View>
      <View style={styles.hero}>
        <View><Text style={styles.heroLabel}>RAKİBİN</Text><Text style={styles.heroName}>🤖 Yapay Zekâ</Text></View>
        <View style={styles.levelWrap}>{levels.map(l=><Pressable key={l} onPress={()=>{if(!busy&&turn==="white"&&!chainActive){setDifficulty(l);setStatus("Zorluk "+l+" seçildi.");}}} style={[styles.level,difficulty===l&&styles.levelActive]}><Text style={[styles.levelText,difficulty===l&&styles.levelTextActive]}>{l}</Text></Pressable>)}</View>
        <Text style={styles.levelHint}>Seviye: {difficulty} • {levelConfig[difficulty].depth} hamle derinliğinde analiz</Text>
      </View>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCard}><Text style={styles.scoreLabel}>SEN • BEYAZ</Text><Text style={styles.scoreNumber}>{whiteCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
        <View style={styles.turnPill}><Text style={styles.turnText}>{busy?"RAKİP DÜŞÜNÜYOR":turn==="white"?"SIRA SENDE":"RAKİPTE"}</Text><Text style={styles.turnDot}>●</Text></View>
        <View style={styles.scoreCard}><Text style={styles.scoreLabel}>YAPAY ZEKÂ • SİYAH</Text><Text style={styles.scoreNumber}>{blackCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
      </View>
      <View style={styles.boardOuter}>
        <View style={styles.board} onLayout={e=>setBoardWidth(e.nativeEvent.layout.width)}>
          {board.map((row,r)=><View key={r} style={styles.row}>{row.map((piece,c)=>{
            const isLight=(r+c)%2===0,isSelected=selected?.r===r&&selected?.c===c;
            const isLegal=legal.some(m=>m.to.r===r&&m.to.c===c);
            const isMovingSource=animating?.from.r===r&&animating?.from.c===c;
            return <Pressable key={c} onPress={()=>tapSquare(r,c)} style={[styles.square,isLight?styles.lightSquare:styles.darkSquare,isSelected&&styles.selectedSquare,isLegal&&styles.legalSquare]}>
              {piece&&!isMovingSource&&<View style={[styles.piece,piece.side==="white"?styles.whitePiece:styles.blackPiece,isSelected&&styles.pieceSelected]}>
                <View style={[styles.pieceShine,piece.side==="white"?styles.whiteShine:styles.blackShine]}/>
                {piece.king&&<Text style={[styles.crown,piece.side==="white"?styles.whiteCrown:styles.blackCrown]}>♛</Text>}
              </View>}
              {isLegal&&!piece&&<View style={styles.moveDot}/>}
            </Pressable>;
          })}</View>)}
          {animating&&cell>0&&<Animated.View pointerEvents="none" style={[movingStyle,{transform:[{translateX},{translateY}]}]}>
            <View style={[styles.piece,styles.animatedPiece,animating.piece.side==="white"?styles.whitePiece:styles.blackPiece]}>
              <View style={[styles.pieceShine,animating.piece.side==="white"?styles.whiteShine:styles.blackShine]}/>
              {animating.piece.king&&<Text style={[styles.crown,animating.piece.side==="white"?styles.whiteCrown:styles.blackCrown]}>♛</Text>}
            </View>
          </Animated.View>}
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
        <Text style={styles.ruleText}>• Beyaz taşlarla sen oynarsın. Taşlar ileri ve yana bir kare gider.</Text>
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
  newButton:{backgroundColor:"#c49b4a",paddingVertical:10,paddingHorizontal:13,borderRadius:12},
  newButtonText:{color:"#17231d",fontWeight:"900",fontSize:12},
  hero:{backgroundColor:"#1a2c25",borderColor:"#344a3d",borderWidth:1,borderRadius:16,padding:14,marginBottom:14},
  heroLabel:{color:"#a9b5a8",fontSize:9,letterSpacing:2,fontWeight:"800"},
  heroName:{color:"#f6edda",fontSize:17,fontWeight:"800",marginTop:4},
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
  boardOuter:{backgroundColor:"#39281b",padding:9,borderRadius:18,borderWidth:3,borderColor:"#9a713b",shadowColor:"#000",shadowOpacity:.35,shadowRadius:12,elevation:8},
  board:{borderWidth:2,borderColor:"#21180f",position:"relative",overflow:"hidden"},
  row:{flexDirection:"row"},square:{width:"12.5%",aspectRatio:1,alignItems:"center",justifyContent:"center"},
  lightSquare:{backgroundColor:"#d9bd8c"},darkSquare:{backgroundColor:"#79502f"},
  selectedSquare:{backgroundColor:"#d5b04f"},legalSquare:{backgroundColor:"#9db17a"},
  piece:{width:"76%",height:"76%",borderRadius:100,alignItems:"center",justifyContent:"center",borderWidth:2,shadowColor:"#000",shadowOpacity:.45,shadowRadius:3,elevation:4},
  animatedPiece:{width:"100%",height:"100%"},whitePiece:{backgroundColor:"#f2e7cf",borderColor:"#b8a47f"},
  blackPiece:{backgroundColor:"#202522",borderColor:"#090d0b"},
  pieceShine:{position:"absolute",top:"12%",left:"18%",width:"27%",height:"15%",borderRadius:20,transform:[{rotate:"-28deg"}]},
  whiteShine:{backgroundColor:"#fff9eb"},blackShine:{backgroundColor:"#67716a"},
  pieceSelected:{borderColor:"#f7d66d",borderWidth:3},crown:{fontSize:19,fontWeight:"900"},
  whiteCrown:{color:"#9c722d"},blackCrown:{color:"#e2bd65"},
  moveDot:{width:10,height:10,borderRadius:10,backgroundColor:"#e8f2cf",borderWidth:1,borderColor:"#536c40"},
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
