
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
let backgroundRemover;
let whiteLogo = null;
const logoImage = new Image();
logoImage.onload = () => {
  // The supplied logo has black lettering on a white panel. Keep only its
  // lettering and turn it white so it sits naturally on dark clothing.
  const crop = document.createElement('canvas');
  crop.width = 610; crop.height = 225;
  const ink = crop.getContext('2d', {willReadFrequently:true});
  ink.drawImage(logoImage, 350, 370, 610, 225, 0, 0, 610, 225);
  const pixels = ink.getImageData(0, 0, crop.width, crop.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const darkness = 255 - (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
    pixels.data[i + 3] = Math.round(pixels.data[i + 3] * Math.max(0, (darkness - 70) / 185));
  }
  ink.putImageData(pixels, 0, 0);
  whiteLogo = crop;
  draw();
};
logoImage.src = './Fort Logo.png';

async function cutOut(file) {
  if (!backgroundRemover) {
    const module = await import('https://esm.sh/@imgly/background-removal@1.7.0?bundle');
    backgroundRemover = module.removeBackground;
  }
  return backgroundRemover(file, {model:'isnet_fp16', progress:(key,current,total)=>{
    if (total && /fetch|download/i.test(key)) setStatus(`Loading portrait model… ${Math.round(current/total*100)}%`);
  }});
}

async function isTransparentPNG(file) {
  if (file.type !== 'image/png') return false;
  const bitmap = await createImageBitmap(file);
  const probe = document.createElement('canvas');
  probe.width = Math.min(bitmap.width, 512);
  probe.height = Math.min(bitmap.height, 512);
  const pixels = probe.getContext('2d', {willReadFrequently:true});
  pixels.drawImage(bitmap, 0, 0, probe.width, probe.height);
  bitmap.close();
  const rgba = pixels.getImageData(0, 0, probe.width, probe.height).data;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) return true;
  return false;
}

async function cleanCutout(blob) {
  const bitmap = await createImageBitmap(blob);
  const layer = document.createElement('canvas');
  const w = layer.width = bitmap.width, h = layer.height = bitmap.height;
  const context = layer.getContext('2d', {willReadFrequently:true});
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, w, h);
  const rgba = image.data, count = w * h;
  const labels = new Uint32Array(count), stack = new Int32Array(count);
  const sizes = [0];
  let largest = 0;
  for (let p = 0; p < count; p++) {
    if (labels[p] || rgba[p * 4 + 3] < 55) continue;
    const label = sizes.length;
    let head = 0, tail = 0;
    stack[tail++] = p; labels[p] = label;
    while (head < tail) {
      const at = stack[head++], x = at % w;
      let next = at - 1;
      if (x && !labels[next] && rgba[next * 4 + 3] >= 55) { labels[next] = label; stack[tail++] = next; }
      next = at + 1;
      if (x < w - 1 && !labels[next] && rgba[next * 4 + 3] >= 55) { labels[next] = label; stack[tail++] = next; }
      next = at - w;
      if (at >= w && !labels[next] && rgba[next * 4 + 3] >= 55) { labels[next] = label; stack[tail++] = next; }
      next = at + w;
      if (next < count && !labels[next] && rgba[next * 4 + 3] >= 55) { labels[next] = label; stack[tail++] = next; }
    }
    sizes.push(tail); largest = Math.max(largest, tail);
  }
  const minimum = Math.max(150, largest * .015);
  for (let p = 0; p < count; p++) {
    const a = rgba[p * 4 + 3];
    rgba[p * 4 + 3] = sizes[labels[p]] >= minimum
      ? Math.round(Math.min(255, Math.max(0, (a - 55) * 255 / 165))) : 0;
  }
  context.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => layer.toBlob(b => b ? resolve(b) : reject(new Error('Could not clean cutout')), 'image/png'));
}

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

  // Cut a broad opening into the C before compositing the headline. Keeping
  // the letters on a separate canvas preserves the circular ring underneath.
  const lettering = document.createElement('canvas');
  lettering.width = W; lettering.height = H;
  const type = lettering.getContext('2d');
  type.fillStyle = red;
  type.font = '680px Anton, Impact, sans-serif';
  type.textBaseline = 'alphabetic';
  const title = 'BEC';
  const natural = type.measureText(title).width;
  type.save(); type.translate(68,700); type.scale(984/natural,1); type.fillText(title,0,0); type.restore();
  type.clearRect(910, 410, W - 910, 155);
  ctx.drawImage(lettering, 0, 0);

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

  // Place the year in the newly opened counter of the C.
  ctx.fillStyle = red;
  ctx.font = '132px Anton, Impact, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('’26', 920, 530);

  // Event details sit in the lower corners, as in the final poster.
  function fittedText(value, x, y, size, width, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px Anton, Impact, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const measured = ctx.measureText(value).width;
    ctx.translate(x, y);
    if (measured > width) ctx.scale(width / measured, 1);
    ctx.fillText(value, 0, 0);
    ctx.restore();
  }
  fittedText('7–11', 55, 1130, 102, 252, red);
  fittedText('OCTOBER', 55, 1225, 91, 280, '#111216');
  fittedText('2026', 55, 1315, 104, 250, red);

  fittedText('THE FORTRESS', 800, 1200, 64, 280, red);
  fittedText('PLOT 303 LAMINGO ROAD', 800, 1250, 35, 285, '#111216');
  fittedText('JOS, PLATEAU STATE.', 800, 1294, 37, 280, '#111216');

  if (whiteLogo && subject) {
    // Compact white ministry mark at the foot of the portrait.
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'miter';
    ctx.shadowColor = '#171717';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(533,1369); ctx.lineTo(533,1325);
    ctx.lineTo(539,1325); ctx.lineTo(539,1316);
    ctx.lineTo(546,1316); ctx.lineTo(546,1321);
    ctx.lineTo(553,1321); ctx.lineTo(553,1316);
    ctx.lineTo(560,1316); ctx.lineTo(560,1325);
    ctx.lineTo(566,1325); ctx.lineTo(566,1369);
    ctx.moveTo(529,1369); ctx.lineTo(570,1369);
    ctx.moveTo(544,1369); ctx.lineTo(544,1340); ctx.lineTo(554,1340); ctx.lineTo(554,1369);
    ctx.stroke();
    ctx.drawImage(whiteLogo, 568, 1325, 91, 34);
    ctx.restore();
  }
}

function setStatus(message, type='') { status.textContent = message; status.dataset.type = type; }
function setBusy(value) { busy=value; fileInput.disabled=value; download.disabled=value || !subject; reset.disabled=value; progress.hidden=!value; }
function imageFromURL(url) { return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=url; }); }

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { setStatus('Choose a JPG, PNG, or WebP image.','error'); return; }
  if (file.size > 15*1024*1024) { setStatus('Choose an image smaller than 15 MB.','error'); return; }
  setBusy(true); setStatus('Preparing your photo. The first background removal may take a minute…');
  try {
    let result;
    const transparent = await isTransparentPNG(file);
    result = transparent ? file : await cleanCutout(await cutOut(file));
    const url = URL.createObjectURL(result);
    const img = await imageFromURL(url);
    if (subjectURL) URL.revokeObjectURL(subjectURL);
    subjectURL=url; subject=img;
    setStatus(transparent ? 'Transparent PNG loaded without changing its cutout. Adjust and download.' : 'Background cleaned. Adjust your portrait and download the PNG.','success');
    draw();
  } catch(err) {
    console.error(err);
    setStatus('Background removal could not finish. Try a transparent PNG from remove.bg, or check your internet connection.','error');
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
