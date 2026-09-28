import template from './template.html?raw';
document.querySelector('#app').innerHTML = template;
import '@fontsource/anton/400.css';
import './style.css';
import { removeBackground } from '@imgly/background-removal';

const canvas = document.querySelector('#poster');
const ctx = canvas.getContext('2d');
const fileInput = document.querySelector('#file');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const download = document.querySelector('#download');
const position = document.querySelector('#position');
const scale = document.querySelector('#scale');
const reset = document.querySelector('#reset');
let subject = null;
let subjectURL = null;
let busy = false;

const red = '#c90000';
const W = 1120, H = 1400;
canvas.width = W; canvas.height = H;

function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#f6f6f5'; ctx.fillRect(0,0,W,H);
  const wash = ctx.createRadialGradient(530, 360, 100, 540, 480, 1020);
  wash.addColorStop(0,'#ffffff'); wash.addColorStop(1,'#ececeb');
  ctx.fillStyle = wash; ctx.fillRect(0,0,W,H);

  // Progress circle: pale track and short red segment. Always behind the type and person.
  const cx = 654, cy = 500, r = 458;
  ctx.lineWidth = 23; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#cecece'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle = red; ctx.beginPath(); ctx.arc(cx,cy,r,-1.30,0.07); ctx.stroke();

  // Condensed headline measured to fit the canvas exactly.
  ctx.fillStyle = red;
  ctx.font = '680px Anton, Impact, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const title = 'BEC';
  const natural = ctx.measureText(title).width;
  ctx.save(); ctx.translate(68,700); ctx.scale(984/natural,1); ctx.fillText(title,0,0); ctx.restore();

  ctx.font = '132px Anton, Impact, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('’26', 882, 532);

  if (subject) {
    const factor = Number(scale.value)/100;
    const imageHeight = H * factor;
    const imageWidth = subject.width / subject.height * imageHeight;
    const x = W/2 - imageWidth/2 + Number(position.value);
    const y = H - imageHeight + 10;
    // Preserve photographic texture; only desaturate the subject.
    ctx.save(); ctx.filter = 'grayscale(1) contrast(1.04)';
    ctx.drawImage(subject,x,y,imageWidth,imageHeight);
    ctx.restore();
  } else {
    ctx.fillStyle = '#303030';
    ctx.font = '26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Your portrait appears here',W/2,1020);
    ctx.textAlign = 'start';
  }
}

function setStatus(message, type='') { status.textContent = message; status.dataset.type = type; }
function setBusy(value) { busy=value; fileInput.disabled=value; download.disabled=value || !subject; reset.disabled=value; progress.hidden=!value; }
function imageFromURL(url) { return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=url; }); }

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { setStatus('Choose a JPG, PNG, or WebP image.','error'); return; }
  if (file.size > 15*1024*1024) { setStatus('Choose an image smaller than 15 MB.','error'); return; }
  setBusy(true); setStatus('Removing the background. The first run downloads the model and may take a minute…');
  try {
    const result = await removeBackground(file, {model:'isnet_quint8', progress:(key,current,total)=>{
      if (total && /fetch|download/i.test(key)) setStatus(`Loading portrait model… ${Math.round(current/total*100)}%`);
    }});
    const url = URL.createObjectURL(result);
    const img = await imageFromURL(url);
    if (subjectURL) URL.revokeObjectURL(subjectURL);
    subjectURL=url; subject=img;
    setStatus('Ready. Adjust your portrait and download the PNG.','success');
    draw();
  } catch(err) {
    console.error(err);
    setStatus('Background removal failed. Try a clear photo and check your internet connection.','error');
  } finally { setBusy(false); fileInput.value=''; }
});

[position,scale].forEach(el=>el.addEventListener('input',()=>{document.querySelector('#scale-value').value=scale.value+'%';draw();}));
reset.addEventListener('click',()=>{ position.value='0'; scale.value='91'; draw(); });
download.addEventListener('click',()=>{
  if (!subject || busy) return;
  canvas.toBlob(blob=>{
    if (!blob) { setStatus('Could not prepare the PNG.','error'); return; }
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='BEC-26-portrait.png'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
});
await document.fonts.ready;
draw();
