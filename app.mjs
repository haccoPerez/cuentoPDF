import * as pdfjs from './pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='./pdf.worker.min.mjs';
const $=id=>document.getElementById(id);let pdf=null,page=1,count=3,rotation=0,wide=true,story=true,busy=false,demo=false,key='',resizeTimer,noticeTimer,renderTask,version=0;
const tales=[['El bosque que escuchaba','Al final del camino había un bosque que guardaba todas las historias que el viento le contaba. Nadie tenía prisa allí. Ni siquiera las hojas cuando caían.'],['Una luz entre las ramas','Una tarde, una pequeña luciérnaga decidió iluminar el sendero. No necesitaba alumbrar todo el bosque. Bastaba con mostrar el siguiente paso.'],['Un lugar al que volver','Y así descubrió que las mejores historias no siempre terminan. A veces se quedan contigo, esperando ese ratito de calma en el que vuelves a abrir un libro.']];
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('toast').hidden=true,6500)}
function controls(){$('pageInfo').textContent=`${demo?'Cuento de muestra · ':''}${page} de ${count}`;$('pageNumber').value=page;$('pageNumber').max=count;$('total').textContent=`de ${count}`;$('previous').disabled=page<=1||busy;$('floatingPrevious').disabled=page<=1||busy;$('next').disabled=page>=count||busy}
async function render(){const token=++version;renderTask?.cancel();controls();if(demo){$('canvas').hidden=true;$('sample').hidden=false;$('sample').innerHTML=`<div class="chapter">UN CUENTO PARA BAJAR EL RITMO · ${page}</div><h2>${tales[page-1][0]}</h2><p>${tales[page-1][1]}</p><div class="leaf">❧</div>`;return}if(!pdf)return;$('sample').hidden=true;$('canvas').hidden=false;try{const p=await pdf.getPage(page);if(token!==version)return;const base=p.getViewport({scale:1,rotation:(p.rotate+rotation)%360}),s=$('stage'),availableW=Math.max(100,s.clientWidth),availableH=Math.max(100,s.clientHeight);const scale=wide?availableW/base.width:Math.min(availableW/base.width,availableH/base.height),dpr=Math.min(devicePixelRatio||1,2);const viewport=p.getViewport({scale:scale*dpr,rotation:(p.rotate+rotation)%360}),canvas=$('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=`${viewport.width/dpr}px`;canvas.style.height=`${viewport.height/dpr}px`;renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(token===version)s.scrollTop=0;}catch(e){if(e.name!=='RenderingCancelledException')notify('No se pudo dibujar esta página. Prueba con otro PDF.')}}
async function go(n){n=Number(n);if(busy||!Number.isInteger(n)||n<1||n>count||n===page){controls();return}busy=true;controls();const direction=n>page?1:-1,animate=story&&!matchMedia('(prefers-reduced-motion: reduce)').matches;try{if(animate)await $('sheet').animate([{transform:'rotateY(0deg)',opacity:1},{transform:`rotateY(${-direction*75}deg)`,opacity:.25}],{duration:180,easing:'ease-in'}).finished;page=n;await render();if(animate)await $('sheet').animate([{transform:`rotateY(${direction*75}deg)`,opacity:.25},{transform:'rotateY(0deg)',opacity:1}],{duration:240,easing:'ease-out'}).finished;if(key)try{localStorage.setItem(key,page)}catch{}}finally{busy=false;controls()}}
function showReader(name){$('filename').textContent=name;$('home').hidden=true;$('reader').hidden=false;$('reader').classList.add('zen');requestAnimationFrame(render)}
let opening=false;
async function openBook(book,button){
 if(opening)return;opening=true;button.disabled=true;notify('Abriendo tu historia…');
 try{
  let source={url:book.url};
  if(book.parts){
   const chunks=[];let size=0;
   for(const url of book.parts){const response=await fetch(url);if(!response.ok)throw Error('Download failed');const chunk=new Uint8Array(await response.arrayBuffer());chunks.push(chunk);size+=chunk.length}
   const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}source={data};
  }
  const task=pdfjs.getDocument(source);
  task.onPassword=(callback,reason)=>{const value=prompt(reason===2?'Contraseña incorrecta. Inténtalo de nuevo:':'Contraseña del PDF:');if(value===null)task.destroy();else callback(value)};
  const next=await task.promise;renderTask?.cancel();if(pdf)await pdf.destroy();pdf=next;demo=false;count=pdf.numPages;rotation=0;key='entrehojas:library:'+book.url;
  try{page=Math.min(count,Math.max(1,Number(localStorage.getItem(key))||1))}catch{page=1}
  showReader(book.title);$('toast').hidden=true;
 }catch{notify('No se pudo abrir el libro. Revisa tu conexión e inténtalo de nuevo.')}finally{opening=false;button.disabled=false}
}
async function loadLibrary(){
 try{const response=await fetch('./libros/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error();const books=await response.json();$('books').replaceChildren();$('bookCount').textContent=books.length+' libros';
  if(!books.length){$('books').textContent='Todavía no hay libros disponibles.';return}
  for(const [index,book] of books.entries()){
   const button=document.createElement('button');button.className='book-card';
   const cover=document.createElement('span');cover.className='book-cover';cover.textContent='❧';
   const title=document.createElement('strong');title.textContent=book.title;
   const action=document.createElement('span');action.className='book-action';action.textContent='Abrir libro →';
   button.append(cover,title,action);button.onclick=()=>openBook(book,button);$('books').append(button);
  }
 }catch{$('books').textContent='No pudimos cargar la biblioteca.';const retry=document.createElement('button');retry.textContent='Reintentar';retry.className='tool';retry.onclick=loadLibrary;$('books').append(retry)}
}
loadLibrary();
$('demo').onclick=()=>{demo=true;page=1;count=3;key='';showReader('El bosque que escuchaba')};$('next').onclick=()=>go(page+1);$('previous').onclick=()=>go(page-1);$('floatingPrevious').onclick=()=>go(page-1);$('pageNumber').onchange=e=>go(e.target.value);$('story').onclick=()=>{story=!story;$('story').classList.toggle('active',story);$('story').setAttribute('aria-pressed',story)};$('fit').onclick=()=>{wide=!wide;$('fit').textContent=wide?'Página completa':'Ajustar ancho';render()};$('rotate').onclick=()=>{if(demo){notify('La rotación está disponible al abrir tu PDF.');return}rotation=(rotation+90)%360;render()};$('zen').onclick=()=>{$('reader').classList.add('zen');render()};$('reveal').onclick=()=>{$('reader').classList.remove('zen');render()};
$('full').onclick=async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();return}if($('reader').requestFullscreen){await $('reader').requestFullscreen();$('reader').classList.add('zen')}else{$('reader').classList.add('zen');notify('Modo sin controles activado. Para ocultar también las barras en iPhone, añade esta web a la pantalla de inicio.')}}catch{$('reader').classList.add('zen');notify('Tu navegador no permite pantalla completa aquí. Activamos la lectura sin controles.')}};
$('back').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();$('reader').hidden=true;$('reader').classList.remove('zen');$('home').hidden=false};$('theme').onclick=()=>document.body.classList.toggle('dark');document.addEventListener('keydown',e=>{if($('reader').hidden||e.target.tagName==='INPUT')return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();go(page+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(page-1)}if(e.key==='Escape'){$('reader').classList.remove('zen');render()}});let start; $('stage').addEventListener('touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY};else start=null},{passive:true});$('stage').addEventListener('touchend',e=>{if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*2)go(page+(dx<0?1:-1));start=null},{passive:true});window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!$('reader').hidden)render()},150)});
