export function surface(width = 960, height = 540) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return canvas;
}
function polygon(ctx, points, fill) {
  ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

/** A hand-drawn animated stand-in. It uses the same shader pipeline as the webcam. */
export class DemoScene {
  constructor() { this.source = surface(); this.mask = surface(); }
  draw(time, fist = false, expression = false) {
    const ctx = this.source.getContext('2d'), mask = this.mask.getContext('2d');
    const w = this.source.width, h = this.source.height;
    const bg = ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,'#b9b6b1'); bg.addColorStop(1,'#626d74');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#d3cfc6'; ctx.fillRect(45,28,270,390);
    ctx.fillStyle = '#939b99'; ctx.fillRect(60,42,238,360);
    ctx.strokeStyle = '#c6c6bd'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(180,42);ctx.lineTo(180,400);ctx.moveTo(60,225);ctx.lineTo(300,225);ctx.stroke();
    ctx.fillStyle = '#41484a';ctx.fillRect(760,210,135,14);ctx.fillRect(748,360,164,15);
    ['#8d7768','#b6afa0','#5c6b70'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(775+i*28,156-i*8,22,54+i*8);});
    mask.fillStyle='#000';mask.fillRect(0,0,w,h);
    const sway = Math.sin(time*.65)*15;
    for (const [c,isMask] of [[ctx,false],[mask,true]]) {
      c.save(); c.translate(sway,Math.sin(time*.9)*3);
      const skin = isMask ? '#fff' : '#c9a98f', jacket = isMask ? '#fff' : '#3f4b58';
      // Shoulders, high collar, and neck.
      polygon(c,[[300,540],[326,400],[419,353],[474,340],[608,344],[698,396],[746,540]],jacket);
      polygon(c,[[471,287],[590,287],[605,371],[529,416],[464,365]],skin);
      polygon(c,[[319,540],[363,413],[457,365],[510,432],[487,540]],isMask?'#fff':'#74828d');
      polygon(c,[[557,421],[611,362],[692,407],[741,540],[588,540]],isMask?'#fff':'#4d6170');
      polygon(c,[[452,358],[479,358],[530,411],[500,449],[431,388]],isMask?'#fff':'#9bacae');
      polygon(c,[[609,354],[632,384],[566,450],[532,411]],isMask?'#fff':'#283642');
      // Head and ears.
      c.fillStyle=skin;c.beginPath();c.ellipse(529,223,95,123,-.055,0,Math.PI*2);c.fill();
      c.beginPath();c.ellipse(431,235,13,26,-.15,0,Math.PI*2);c.ellipse(622,230,12,25,.2,0,Math.PI*2);c.fill();
      if (!isMask) {
        polygon(c,[[551,125],[600,168],[610,263],[567,322],[536,327],[558,271],[550,217]],'#a78072');
        polygon(c,[[457,224],[500,233],[502,269],[466,260]],'#dfbca0');
        polygon(c,[[526,222],[511,274],[539,276]],'#a77d69');
        c.strokeStyle='#403c3b';c.lineWidth=5;c.beginPath();c.moveTo(462,222);c.lineTo(500,218);c.moveTo(556,216);c.lineTo(592,217);c.stroke();
        c.fillStyle='#292b2e';c.beginPath();c.ellipse(487,230,5,6,0,0,Math.PI*2);c.ellipse(568,225,5,6,0,0,Math.PI*2);c.fill();
        if(expression){
          c.fillStyle='#f5eee5';c.beginPath();c.ellipse(487,230,13,12,0,0,Math.PI*2);c.ellipse(568,225,13,12,0,0,Math.PI*2);c.fill();
          c.fillStyle='#292b2e';c.beginPath();c.ellipse(487,230,5,7,0,0,Math.PI*2);c.ellipse(568,225,5,7,0,0,Math.PI*2);c.fill();
          c.fillStyle='#553b3e';c.beginPath();c.ellipse(531,300,15,19,0,0,Math.PI*2);c.fill();
        }else{c.strokeStyle='#805951';c.lineWidth=3;c.beginPath();c.moveTo(508,299);c.quadraticCurveTo(533,306,552,295);c.stroke();}
        c.strokeStyle='#34373e';c.lineWidth=3;c.strokeRect(452,211,55,37);c.strokeRect(548,207,54,36);c.beginPath();c.moveTo(508,222);c.lineTo(548,219);c.stroke();
      }
      polygon(c,[[421,214],[417,160],[440,108],[491,77],[551,74],[602,97],[635,148],[632,208],[609,182],[590,138],[567,199],[550,164],[532,215],[514,157],[488,197],[480,159],[450,211],[447,248]],isMask?'#fff':'#222831');
      if (!isMask) {
        polygon(c,[[453,127],[492,91],[540,87],[511,131],[489,174],[488,138]],'#414b53');
        polygon(c,[[542,89],[591,108],[615,154],[584,130],[563,170]],'#39414c');
        c.strokeStyle='#b2b7af';c.lineWidth=2;c.beginPath();c.moveTo(532,421);c.lineTo(545,540);c.stroke();
        c.strokeStyle='#293947';c.lineWidth=5;c.strokeRect(368,459,92,45);
      }
      // Raised forearm and hand make the demo's trigger location visible.
      polygon(c,[[339,494],[290,461],[248,324],[289,304],[346,425]],isMask?'#fff':'#677885');
      c.save();c.translate(270,291);c.rotate(Math.sin(time*.8)*.06-.13);
      c.fillStyle=skin;
      if (fist) {
        c.beginPath();c.roundRect(-28,-54,67,78,17);c.fill();
        if(!isMask){c.strokeStyle='#9b7767';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-10+i*15,-51);c.lineTo(-10+i*15,-22);c.stroke();}}
      } else {
        c.beginPath();c.roundRect(-24,-35,58,66,16);c.fill();
        const fingers=[[-23,-86,15,67],[-5,-108,15,85],[14,-105,15,83],[32,-84,14,64]];
        for(const [x,y,fw,fh] of fingers){c.beginPath();c.roundRect(x,y,fw,fh,9);c.fill();}
        c.save();c.translate(-22,3);c.rotate(-.78);c.beginPath();c.roundRect(-10,-52,18,56,9);c.fill();c.restore();
      }
      c.restore(); c.restore();
    }
    return { source: this.source, mask: this.mask, chest: [(529+sway)/w, .29], hand: [(270+sway)/w, .49], face: [(529+sway)/w, .46] };
  }
}

const cubeVertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const cubeFaces = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
const tetraVertices = [[0,-1.4,0],[-1,1,1],[1,1,1],[0,1,-1.3]];
const tetraFaces = [[0,1,2],[0,2,3],[0,3,1],[1,3,2]];

export class GraphicLayers {
  constructor() { this.graphics = surface(); this.title = surface(); this.lastTitle = ''; }
  draw(time, settings) {
    const ctx=this.graphics.getContext('2d'), w=this.graphics.width,h=this.graphics.height;
    ctx.clearRect(0,0,w,h);
    if(settings.shapes){
      for(let i=0;i<22;i++){
        const seed=i*2.39996, phase=time*(.12+(i%5)*.025)+seed;
        const x=w*(.5+Math.cos(seed)*(.22+(i%3)*.13)) + Math.sin(phase)*23;
        const y=((i*127+time*(i%2?12:-9))%680+680)%680-70;
        const size=12+(i%5)*10, a=phase, b=phase*.7;
        const vertices=(i%3===0?tetraVertices:cubeVertices).map(([vx,vy,vz])=>{
          const xx=vx*Math.cos(a)-vz*Math.sin(a), zz=vx*Math.sin(a)+vz*Math.cos(a);
          const yy=vy*Math.cos(b)-zz*Math.sin(b), z=vy*Math.sin(b)+zz*Math.cos(b);
          return [x+xx*size,y+yy*size,z];
        });
        const faces=(i%3===0?tetraFaces:cubeFaces).map((ids,j)=>({ids,j,z:ids.reduce((s,id)=>s+vertices[id][2],0)/ids.length})).sort((a,b)=>a.z-b.z);
        const palettes=[['#ff4385','#9b154e','#ffd8e2'],['#63e2ef','#12769d','#d4ffff'],['#fff256','#d49510','#fffee4']];
        const palette=palettes[i%3];
        for(const face of faces){
          const pts=face.ids.map(id=>vertices[id]);polygon(ctx,pts,palette[face.j%3]);
          if(face.j%3===1){ctx.save();ctx.clip();ctx.fillStyle='#141b4380';for(let dx=x-size*1.6;dx<x+size*1.6;dx+=5)for(let dy=y-size*1.6;dy<y+size*1.6;dy+=5){ctx.beginPath();ctx.arc(dx,dy,1.15,0,Math.PI*2);ctx.fill();}ctx.restore();}
        }
      }
    }
    const key=`${settings.title}-${settings.titleText}`;
    if(key!==this.lastTitle){
      this.lastTitle=key;const t=this.title.getContext('2d');t.clearRect(0,0,w,h);
      if(settings.title){
        t.save();t.translate(37,375);t.rotate(-.12);
        const lines=(settings.titleText.trim()||'BREAK THE FRAME').toUpperCase().split(/\s+/).slice(0,3);
        t.font='900 italic 48px Arial, sans-serif';
        lines.forEach((line,i)=>{const text=line.slice(0,14);const width=t.measureText(text).width;
          t.fillStyle=i===1?'#f9ef31':'#121a47';t.fillRect(-5,i*46-37,width+16,45);
          t.fillStyle=i===1?'#121a47':'#fff8ec';t.fillText(text,2,i*46);
        });t.restore();
      }
    }
    return { graphics:this.graphics,title:this.title };
  }
}
