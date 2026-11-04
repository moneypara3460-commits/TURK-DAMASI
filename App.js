import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView, StatusBar } from "react-native";

const initialBoard = () => {
  const b = Array.from({length:8},()=>Array(8).fill(null));
  for(let r=1;r<=2;r++) for(let c=0;c<8;c++) b[r][c]={side:"black",king:false};
  for(let r=5;r<=6;r++) for(let c=0;c<8;c++) b[r][c]={side:"white",king:false};
  return b;
};
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const clone=b=>b.map(row=>row.map(p=>p?{...p}:null));
const countPieces=(b,side)=>b.flat().filter(p=>p&&p.side===side).length;

function rawMoves(board,side,fromOnly=null,capturesOnly=false) {
  const moves=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p=board[r][c];
    if(!p||p.side!==side||(fromOnly&&(fromOnly.r!==r||fromOnly.c!==c))) continue;
    if(p.king) {
      for(const [dr,dc] of dirs) {
        let nr=r+dr,nc=c+dc;
        while(inside(nr,nc)&&!board[nr][nc]) {
          if(!capturesOnly) moves.push({from:{r,c},to:{r:nr,c:nc},captured:[]});
          nr+=dr; nc+=dc;
        }
        if(inside(nr,nc)&&board[nr][nc].side!==side) {
          const enemy={r:nr,c:nc};
          let er=nr+dr,ec=nc+dc;
          while(inside(er,ec)&&!board[er][ec]) {
            moves.push({from:{r,c},to:{r:er,c:ec},captured:[enemy]});
            er+=dr; ec+=dc;
          }
        }
      }
    } else {
      const f=side==="white"?-1:1;
      if(!capturesOnly) for(const [dr,dc] of [[f,0],[0,1],[0,-1]]) {
        const nr=r+dr,nc=c+dc;
        if(inside(nr,nc)&&!board[nr][nc]) moves.push({from:{r,c},to:{r:nr,c:nc},captured:[]});
      }
      for(const [dr,dc] of dirs) {
        const mr=r+dr,mc=c+dc,er=r+2*dr,ec=c+2*dc;
        if(inside(mr,mc)&&inside(er,ec)&&board[mr][mc]&&board[mr][mc].side!==side&&!board[er][ec])
          moves.push({from:{r,c},to:{r:er,c:ec},captured:[{r:mr,c:mc}]});
      }
    }
  }
  return moves;
}
function legalMoves(board,side,fromOnly=null) {
  const captures=rawMoves(board,side,null,true);
  if(captures.length) return fromOnly?captures.filter(m=>m.from.r===fromOnly.r&&m.from.c===fromOnly.c):captures;
  return fromOnly?rawMoves(board,side,fromOnly,false):rawMoves(board,side,null,false);
}
function applyStep(board,move,side) {
  const b=clone(board), p=b[move.from.r][move.from.c];
  b[move.from.r][move.from.c]=null;
  move.captured.forEach(sq=>b[sq.r][sq.c]=null);
  const landed={...p};
  if((side==="white"&&move.to.r===0)||(side==="black"&&move.to.r===7)) landed.king=true;
  b[move.to.r][move.to.c]=landed;
  return b;
}
// A complete turn may contain several consecutive captures by the same piece.
function completeTurns(board,side) {
  const first=legalMoves(board,side);
  const out=[];
  function extend(b,move,path) {
    const next=applyStep(b,move,side);
    const nextPath=[...path,move];
    if(move.captured.length) {
      const follow=legalMoves(next,side,move.to).filter(m=>m.captured.length);
      if(follow.length) { follow.forEach(m=>extend(next,m,nextPath)); return; }
    }
    out.push({steps:nextPath,board:next,captures:nextPath.reduce((n,x)=>n+x.captured.length,0)});
  }
  first.forEach(m=>extend(board,m,[]));
  return out;
}
function evaluate(board) {
  let score=0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p=board[r][c]; if(!p) continue;
    let v=p.king?8:3;
    if(!p.king) v+=p.side==="black"?(r*0.08):((7-r)*0.08);
    score+=p.side==="black"?v:-v;
  }
  return score;
}
const levelConfig={
  "Çaylak":{depth:1,noise:3.8,blunder:0.38},
  "Acemi":{depth:2,noise:2.2,blunder:0.25},
  "Usta":{depth:3,noise:1.1,blunder:0.14},
  "Şampiyon":{depth:4,noise:0.45,blunder:0.06},
  "Efsane":{depth:5,noise:0.08,blunder:0.015}
};
function minimax(board,side,depth,alpha,beta) {
  const turns=completeTurns(board,side);
  if(!turns.length) return side==="black"?-10000-depth:10000+depth;
  if(depth<=0) return evaluate(board);
  turns.sort((a,b)=>side==="black"?evaluate(b.board)-evaluate(a.board):evaluate(a.board)-evaluate(b.board));
  if(side==="black") {
    let best=-Infinity;
    for(const t of turns) {
      best=Math.max(best,minimax(t.board,"white",depth-1,alpha,beta));
      alpha=Math.max(alpha,best); if(beta<=alpha) break;
    }
    return best;
  }
  let best=Infinity;
  for(const t of turns) {
    best=Math.min(best,minimax(t.board,"black",depth-1,alpha,beta));
    beta=Math.min(beta,best); if(beta<=alpha) break;
  }
  return best;
}
function aiChoose(board,difficulty) {
  const cfg=levelConfig[difficulty]||levelConfig.Usta;
  const turns=completeTurns(board,"black");
  if(!turns.length) return null;
  const ranked=turns.map(t=>({
    turn:t,
    score:minimax(t.board,"white",cfg.depth-1,-Infinity,Infinity)+t.captures*0.15+(Math.random()-0.5)*cfg.noise
  })).sort((a,b)=>b.score-a.score);
  // Lower levels deliberately choose a weaker move more often. Even Efsane can make a rare mistake.
  if(Math.random()<cfg.blunder&&ranked.length>1) {
    const pool=ranked.slice(0,Math.min(ranked.length,difficulty==="Çaylak"?ranked.length:3));
    return pool[Math.floor(Math.random()*pool.length)].turn;
  }
  return ranked[0].turn;
}

export default function App() {
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
  const whiteCount=useMemo(()=>countPieces(board,"white"),[board]);
  const blackCount=useMemo(()=>countPieces(board,"black"),[board]);

  function reset() {
    setBoard(initialBoard());setSelected(null);setLegal([]);setTurn("white");
    setMovesCount(0);setBusy(false);setChainActive(false);setGameOver(false);
    setStatus("Sıra sende. İlk hamleni yap!");
  }
  function finishCheck(b) {
    if(!countPieces(b,"white")||!legalMoves(b,"white").length) {
      setStatus("Oyun bitti. Yapay zekâ kazandı!");setGameOver(true);return true;
    }
    if(!countPieces(b,"black")||!legalMoves(b,"black").length) {
      setStatus("Tebrikler! Oyunu kazandın!");setGameOver(true);return true;
    }
    return false;
  }
  function runAI(b) {
    setBusy(true);
    setTimeout(()=>{
      const chosen=aiChoose(b,difficulty);
      if(!chosen){setStatus("Tebrikler! Oyunu kazandın!");setGameOver(true);setBusy(false);return;}
      const next=chosen.board;
      setBoard(next);setMovesCount(n=>n+1);setSelected(null);setLegal([]);
      if(!finishCheck(next)) {
        setTurn("white");
        setStatus(chosen.captures?"Rakip birden fazla taş aldı. Sıra sende!":"Rakip hamlesini yaptı. Sıra sende!");
      }
      setBusy(false);
    },350);
  }
  function tapSquare(r,c) {
    if(turn!=="white"||busy||gameOver) return;
    const piece=board[r][c];
    const target=legal.find(m=>m.to.r===r&&m.to.c===c);
    if(selected&&target) {
      const next=applyStep(board,target,"white");
      const more=target.captured.length?legalMoves(next,"white",target.to).filter(m=>m.captured.length):[];
      setBoard(next);
      if(more.length) {
        setSelected(target.to);setLegal(more);setChainActive(true);
        setStatus("Güzel! Aynı taşla almaya devam et. Başka taş alma hamlesi zorunlu.");
        return;
      }
      setSelected(null);setLegal([]);setChainActive(false);setMovesCount(n=>n+1);
      if(!finishCheck(next)) {
        setTurn("black");setStatus("Hamlen tamamlandı. Yapay zekâ düşünüyor...");
        runAI(next);
      }
      return;
    }
    if(piece&&piece.side==="white"&&!chainActive) {
      const moves=legalMoves(board,"white",{r,c}).filter(m=>m.from.r===r&&m.from.c===c);
      setSelected({r,c});setLegal(moves);
      setStatus(moves.some(m=>m.captured.length)?"Taş alma zorunlu. Parlayan karelerden birini seç.":"Taşını hareket ettireceğin kareyi seç.");
    } else if(!chainActive) {setSelected(null);setLegal([]);}
  }
  const levels=["Çaylak","Acemi","Usta","Şampiyon","Efsane"];
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content"/>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>STRATEJİ • ZEKA • SABIR</Text><Text style={styles.title}>TÜRK DAMASI</Text></View>
          <Pressable onPress={reset} style={styles.newButton}><Text style={styles.newButtonText}>↻ Yeni Oyun</Text></Pressable>
        </View>
        <View style={styles.hero}>
          <View><Text style={styles.heroLabel}>RAKİBİN</Text><Text style={styles.heroName}>🤖 Yapay Zekâ</Text></View>
          <View style={styles.levelWrap}>{levels.map(l=><Pressable key={l} onPress={()=>{if(!busy&&turn==="white"&&!chainActive){setDifficulty(l);setStatus("Zorluk "+l+" seçildi. Rakip bir sonraki sırası geldiğinde bu seviyede oynayacak.");}}} style={[styles.level,difficulty===l&&styles.levelActive]}><Text style={[styles.levelText,difficulty===l&&styles.levelTextActive]}>{l}</Text></Pressable>)}</View>
          <Text style={{color:"#c8d0c3",fontSize:10,marginTop:8}}>Seviye: {difficulty} • {levelConfig[difficulty].depth} hamle derinliğinde analiz</Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}><Text style={styles.scoreLabel}>SEN • BEYAZ</Text><Text style={styles.scoreNumber}>{whiteCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
          <View style={styles.turnPill}><Text style={styles.turnText}>{busy?"RAKİP DÜŞÜNÜYOR":turn==="white"?"SIRA SENDE":"RAKİPTE"}</Text><Text style={styles.turnDot}>●</Text></View>
          <View style={styles.scoreCard}><Text style={styles.scoreLabel}>YAPAY ZEKÂ • SİYAH</Text><Text style={styles.scoreNumber}>{blackCount}</Text><Text style={styles.scoreSub}>taş kaldı</Text></View>
        </View>
        <View style={styles.boardOuter}><View style={styles.board}>
          {board.map((row,r)=><View key={r} style={styles.row}>{row.map((piece,c)=>{
            const isLight=(r+c)%2===0,isSelected=selected?.r===r&&selected?.c===c;
            const isLegal=legal.some(m=>m.to.r===r&&m.to.c===c);
            return <Pressable key={c} onPress={()=>tapSquare(r,c)} style={[styles.square,isLight?styles.lightSquare:styles.darkSquare,isSelected&&styles.selectedSquare,isLegal&&styles.legalSquare]}>
              {piece&&<View style={[styles.piece,piece.side==="white"?styles.whitePiece:styles.blackPiece,isSelected&&styles.pieceSelected]}>
                <View style={[styles.pieceShine,piece.side==="white"?styles.whiteShine:styles.blackShine]}/>
                {piece.king&&<Text style={[styles.crown,piece.side==="white"?styles.whiteCrown:styles.blackCrown]}>♛</Text>}
              </View>}
              {isLegal&&!piece&&<View style={styles.moveDot}/>}
            </Pressable>;
          })}</View>)}
        </View></View>
        <View style={styles.statusBox}><Text style={styles.statusIcon}>✦</Text><Text style={styles.statusText}>{status}</Text></View>
        <View style={styles.infoRow}>
          <View style={styles.infoCard}><Text style={styles.infoTitle}>TURLAR</Text><Text style={styles.infoValue}>{movesCount}</Text></View>
          <View style={styles.infoCard}><Text style={styles.infoTitle}>ZORUNLU ALMA</Text><Text style={styles.infoValue}>Açık</Text></View>
          <View style={styles.infoCard}><Text style={styles.infoTitle}>TAHTA</Text><Text style={styles.infoValue}>8 × 8</Text></View>
        </View>
        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>NASIL OYNANIR?</Text>
          <Text style={styles.ruleText}>• Beyaz taşlarla sen oynarsın. Taşlar ileri ve yana bir kare gider.</Text>
          <Text style={styles.ruleText}>• Rakip taşın üzerinden atlayarak taş alırsın. Taş alma zorunludur.</Text>
          <Text style={styles.ruleText}>• Bir taş aldıktan sonra aynı taşla başka alma imkânı varsa devam etmelisin.</Text>
          <Text style={styles.ruleText}>• Son sıraya ulaşan taş vezir olur ve yatay/dikey istediği kadar ilerler.</Text>
          <Text style={styles.ruleText}>• Rakibin tüm taşlarını al veya hamlesiz bırak.</Text>
        </View>
        <Text style={styles.footer}>BAĞIMSIZ TÜRK DAMASI • YAPAY ZEKÂ SÜRÜMÜ</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#101d19"},
  container:{padding:16,paddingBottom:36},
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
  levelText:{fontSize:10,color:"#d2d9cd",fontWeight:"700"},
  levelTextActive:{color:"#17231d"},
  scoreRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  scoreCard:{backgroundColor:"#1a2c25",borderRadius:13,padding:10,minWidth:95,alignItems:"center",borderWidth:1,borderColor:"#344a3d"},
  scoreLabel:{fontSize:8,color:"#c5b27e",fontWeight:"800",letterSpacing:1},
  scoreNumber:{fontSize:25,color:"#f5ecd9",fontWeight:"900",marginTop:2},
  scoreSub:{fontSize:9,color:"#a9b5a8"},
  turnPill:{alignItems:"center",gap:4},
  turnText:{fontSize:8,color:"#e4c77f",fontWeight:"900",letterSpacing:1},
  turnDot:{color:"#d4ad5d",fontSize:12},
  boardOuter:{backgroundColor:"#39281b",padding:9,borderRadius:18,borderWidth:3,borderColor:"#9a713b",shadowColor:"#000",shadowOpacity:.35,shadowRadius:12,elevation:8},
  board:{borderWidth:2,borderColor:"#21180f"},
  row:{flexDirection:"row"},
  square:{width:"12.5%",aspectRatio:1,alignItems:"center",justifyContent:"center"},
  lightSquare:{backgroundColor:"#d9bd8c"},
  darkSquare:{backgroundColor:"#79502f"},
  selectedSquare:{backgroundColor:"#d5b04f"},
  legalSquare:{backgroundColor:"#9db17a"},
  piece:{width:"76%",height:"76%",borderRadius:100,alignItems:"center",justifyContent:"center",borderWidth:2,shadowColor:"#000",shadowOpacity:.45,shadowRadius:3,elevation:4},
  whitePiece:{backgroundColor:"#f2e7cf",borderColor:"#b8a47f"},
  blackPiece:{backgroundColor:"#202522",borderColor:"#090d0b"},
  pieceShine:{position:"absolute",top:"12%",left:"18%",width:"27%",height:"15%",borderRadius:20,transform:[{rotate:"-28deg"}]},
  whiteShine:{backgroundColor:"#fff9eb"},
  blackShine:{backgroundColor:"#67716a"},
  pieceSelected:{borderColor:"#f7d66d",borderWidth:3},
  crown:{fontSize:19,fontWeight:"900"},
  whiteCrown:{color:"#9c722d"},
  blackCrown:{color:"#e2bd65"},
  moveDot:{width:10,height:10,borderRadius:10,backgroundColor:"#e8f2cf",borderWidth:1,borderColor:"#536c40"},
  statusBox:{marginTop:14,backgroundColor:"#24372d",borderColor:"#49634d",borderWidth:1,borderRadius:13,padding:13,flexDirection:"row",alignItems:"center",gap:9},
  statusIcon:{color:"#e0bd69",fontSize:18},
  statusText:{color:"#f3ead7",fontWeight:"700",fontSize:12,flex:1},
  infoRow:{flexDirection:"row",gap:8,marginTop:12},
  infoCard:{flex:1,backgroundColor:"#1a2c25",borderRadius:12,padding:10,borderWidth:1,borderColor:"#344a3d"},
  infoTitle:{fontSize:8,color:"#aeb9aa",fontWeight:"800",letterSpacing:.5},
  infoValue:{fontSize:15,color:"#e5c477",fontWeight:"900",marginTop:5},
  rules:{marginTop:17,backgroundColor:"#172720",borderRadius:14,padding:14,borderWidth:1,borderColor:"#2e4438"},
  rulesTitle:{color:"#e2bd69",fontWeight:"900",fontSize:11,letterSpacing:1.5,marginBottom:8},
  ruleText:{color:"#d3d9ce",fontSize:11,lineHeight:19,marginBottom:3},
  footer:{textAlign:"center",fontSize:8,color:"#718477",letterSpacing:1.2,marginTop:18}
});
