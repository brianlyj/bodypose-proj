const vertex = `#version 300 es
in vec2 aPosition;
out vec2 uv;
void main(){ uv=aPosition*.5+.5; gl_Position=vec4(aPosition,0.,1.); }`;

const smoothFragment = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uSmoothing;
in vec2 uv; out vec4 color;
void main(){
  vec3 winner=texture(uSource,uv).rgb; float lowest=100.;
  for(int q=0;q<4;q++){
    vec2 direction=vec2(q%2==0?-1.:1.,q<2?-1.:1.);
    vec3 mean=vec3(0.), square=vec3(0.);
    for(int y=0;y<=2;y++) for(int x=0;x<=2;x++){
      vec3 sampleColor=texture(uSource,uv+vec2(x,y)*direction*uTexel*uSmoothing).rgb;
      mean+=sampleColor; square+=sampleColor*sampleColor;
    }
    mean/=9.; vec3 variance=abs(square/9.-mean*mean);
    float total=dot(variance,vec3(1.));
    if(total<lowest){lowest=total; winner=mean;}
  }
  color=vec4(winner,1.);
}`;

const compositeFragment = `#version 300 es
precision highp float;
uniform sampler2D uSource, uSmooth, uMask, uGraphics, uTitle;
uniform vec2 uResolution, uOrigin, uChest;
uniform float uTime, uIntensity, uHalftone, uOutline, uRays, uFlames, uFrom, uTo, uProgress, uSplit, uPalette;
in vec2 uv; out vec4 color;
const float PI=3.14159265359;
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float maskAt(vec2 p){return smoothstep(.32,.72,texture(uMask,clamp(p,0.,1.)).r);}
vec3 over(vec3 base,vec4 layer){return mix(base,layer.rgb,layer.a);}
vec3 stylize(vec2 p){
  vec2 px=1./uResolution;
  vec3 raw=texture(uSource,p).rgb;
  float l=lum(texture(uSmooth,p).rgb);
  float tones=floor(clamp((l-.05)*1.35,0.,.999)*5.)/4.;
  vec3 navy=vec3(.025,.045,.23), blue=vec3(.05,.29,1.), sky=vec3(.26,.73,1.);
  if(uPalette>.5){navy=vec3(.16,.015,.24);blue=vec3(.57,.08,.91);sky=vec3(1.,.30,.66);}
  vec3 person=mix(navy,mix(blue,sky,smoothstep(.30,.95,p.y)),tones);
  person*=mix(.55,1.12,smoothstep(.08,.82,p.y));
  float edge=abs(l-lum(texture(uSmooth,p+vec2(px.x*2.,0.)).rgb))+abs(l-lum(texture(uSmooth,p+vec2(0.,px.y*2.)).rgb));
  person=mix(person,navy,smoothstep(.055,.20,edge)*.8);
  float m=maskAt(p), expanded=m;
  for(int i=0;i<8;i++){
    float a=float(i)*PI/4.;
    expanded=max(expanded,maskAt(p+vec2(cos(a),sin(a))*px*uOutline));
  }
  float rim=clamp(m-maskAt(p+vec2(-px.x*8.,-px.y*5.)),0.,1.);
  person=mix(person,vec3(1.,.55,.06),rim*.95);

  vec3 bg=mix(vec3(.55,.12,.74),vec3(.02,.72,.93),smoothstep(.10,.92,p.y));
  float dotSize=mix(3.,8.,uHalftone);
  vec2 cell=fract(p*uResolution/dotSize)-.5;
  float radius=mix(.46,.08,lum(raw));
  float dots=1.-smoothstep(radius-.06,radius+.04,length(cell));
  bg=mix(bg,vec3(.025,.04,.17),dots*.78);
  vec2 radial=(p-uChest)*vec2(uResolution.x/uResolution.y,1.);
  float angle=atan(radial.y,radial.x)+PI;
  float sector=angle/(2.*PI)*22.;
  float tick=floor(uTime*4.);
  float rayWidth=mix(.07,.64,hash(floor(sector)+tick*17.));
  float ray=step(fract(sector),rayWidth)*smoothstep(.04,.18,length(radial))*uRays;
  bg=mix(bg,vec3(1.,.89,.015),ray);
  // Three stepped flame contours anchored behind the person.
  for(int i=0;i<3;i++){
    float k=float(i), t=floor(uTime*12.)/12.;
    float sway=sin(p.y*15.-t*2.5+k*2.)*.035+sin(p.y*31.-t*4.)*.013;
    float width=.055+.04*sin(p.y*6.+k)+.025*sin(p.y*19.-t*3.);
    float flame=1.-smoothstep(width,width+.009,abs(p.x-uChest.x-(k-1.)*.16-sway));
    flame*=smoothstep(.18,.42,p.y)*(1.-smoothstep(.77+.06*sin(t+k),.98,p.y));
    vec3 fc=i==0?vec3(1.,.38,.025):i==1?vec3(.98,.07,.48):vec3(.02,.91,.73);
    bg=mix(bg,fc,flame*uFlames);
  }
  bg=over(bg,texture(uGraphics,p));
  bg=mix(bg,vec3(.98,.15,.54),clamp(expanded-m,0.,1.));
  vec3 scene=mix(bg,person,m);
  scene=over(scene,texture(uTitle,p));
  return mix(raw,scene,uIntensity);
}
void main(){
  vec2 p=uv, radial=(p-uOrigin)*vec2(uResolution.x/uResolution.y,1.);
  float angle=atan(radial.y,radial.x)+PI;
  float sector=floor(angle/(2.*PI)*13.);
  float delay=hash(sector+4.)*.19;
  float progress=clamp((uProgress-delay)/.81,0.,1.);
  float reach=progress*2.1;
  float reveal=1.-smoothstep(reach-.035,reach+.035,length(radial));
  if(uProgress>=.999) reveal=1.;
  if(uProgress<=.001) reveal=0.;
  float strength=mix(uFrom,uTo,reveal);
  float motion=sin(PI*uProgress);
  vec2 offset=normalize(radial+vec2(.0001))*.035*motion*(hash(sector+12.)-.25);
  vec3 raw=texture(uSource,uv).rgb;
  vec3 scene=stylize(clamp(p+offset,0.,1.));
  vec3 result=mix(raw,scene,strength);
  float border=(1.-smoothstep(.006,.017,abs(length(radial)-reach)))*motion;
  result=mix(result,vec3(1.,.97,.63),border*.85);
  if(uSplit>.5){result=uv.x<.5?raw:stylize(uv);if(abs(uv.x-.5)<.0015)result=vec3(.9,1.,.35);}
  color=vec4(result,1.);
}`;

export class ComicRenderer {
  constructor(canvas, { width = 960, height = 540 } = {}) {
    this.canvas = canvas; canvas.width = width; canvas.height = height;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL 2 is unavailable. Open this app in a recent Chrome or Edge browser with graphics acceleration enabled.');
    this.programs = [this.program(vertex, smoothFragment), this.program(vertex, compositeFragment)];
    this.uniforms = this.programs.map(p => {
      const locations = {};
      for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
        const name = gl.getActiveUniform(p, i).name; locations[name] = gl.getUniformLocation(p, name);
      }
      return locations;
    });
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const buffer = this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    for (const p of this.programs) {
      const loc = gl.getAttribLocation(p, 'aPosition'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.textures = Array.from({ length: 5 }, () => this.texture());
    this.fbo = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / 2, height / 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[1], 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Could not create the effect render target.');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.dirty = true;
  }
  program(vs, fs) {
    const gl = this.gl, shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, source]) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    const p = gl.createProgram(); shaders.forEach(s => gl.attachShader(p, s)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    shaders.forEach(s => gl.deleteShader(s)); return p;
  }
  texture() {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
    return t;
  }
  upload(index, source) {
    const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, this.textures[index]);
    // WebGL ignores UNPACK_FLIP_Y_WEBGL for ImageBitmap. Normalize worker frames
    // through a canvas so source pixels and the top-down mask share orientation.
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      this.bitmapSurface ??= document.createElement('canvas');
      this.bitmapSurface.width = source.width; this.bitmapSurface.height = source.height;
      this.bitmapSurface.getContext('2d').drawImage(source, 0, 0);
      source = this.bitmapSurface;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  setFrame(source, mask) { this.upload(0, source); this.upload(2, mask); this.dirty = true; }
  render({ time, settings, transition, chest = [.5, .43], graphics, title }) {
    const gl = this.gl, { width, height } = this.canvas;
    gl.bindVertexArray(this.vao);
    this.upload(3, graphics); this.upload(4, title);
    this.textures.forEach((texture, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture); });
    if (this.dirty || this.smoothing !== settings.smoothing) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, width / 2, height / 2);
      gl.useProgram(this.programs[0]); const u = this.uniforms[0];
      gl.uniform1i(u.uSource, 0); gl.uniform2f(u.uTexel, 1 / width, 1 / height); gl.uniform1f(u.uSmoothing, settings.smoothing);
      gl.drawArrays(gl.TRIANGLES, 0, 6); this.dirty = false; this.smoothing = settings.smoothing;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height); gl.useProgram(this.programs[1]);
    const u = this.uniforms[1];
    ['uSource', 'uSmooth', 'uMask', 'uGraphics', 'uTitle'].forEach((name, i) => gl.uniform1i(u[name], i));
    gl.uniform2f(u.uResolution, width, height); gl.uniform2f(u.uOrigin, transition.origin[0], 1 - transition.origin[1]); gl.uniform2fv(u.uChest, chest);
    for (const [name, value] of Object.entries({ uTime: time, uIntensity: settings.intensity, uHalftone: settings.halftone,
      uOutline: settings.outline, uRays: +settings.rays, uFlames: +settings.flames, uPalette: settings.palette,
      uFrom: transition.from, uTo: transition.to, uProgress: transition.progress, uSplit: +settings.split })) gl.uniform1f(u[name], value);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  dispose() {
    const gl = this.gl; this.programs.forEach(p => gl.deleteProgram(p)); this.textures.forEach(t => gl.deleteTexture(t));
    gl.deleteFramebuffer(this.fbo); gl.deleteBuffer(this.buffer); gl.deleteVertexArray(this.vao);
  }
}
