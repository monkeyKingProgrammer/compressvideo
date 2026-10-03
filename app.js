const { createFFmpeg, fetchFile } = FFmpeg;
const $ = (id) => document.getElementById(id);
const dropZone = $('drop-zone'), fileInput = $('file-input'), video = $('video-preview'), info = $('video-info');
const compressButton = $('compress'), status = $('engine-status'), message = $('message'), result = $('result');
const progressBar = $('progress-bar'), progressLabel = $('progress-label'), progressPercent = $('progress-percent');
let selectedFile = null, ffmpeg = null, enginePromise = null;

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'], index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const setProgress = (value, label) => {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  progressBar.style.width = `${percent}%`; progressPercent.textContent = `${percent}%`; progressLabel.textContent = label;
};
const showFile = (file) => {
  if (!file || !file.type.startsWith('video/')) { message.textContent = 'Please choose a video file.'; return; }
  selectedFile = file; video.src = URL.createObjectURL(file); video.classList.remove('hidden'); info.classList.remove('hidden');
  info.innerHTML = `<div class="flex items-center justify-between gap-4"><span class="truncate font-medium text-slate-700">${file.name}</span><span class="shrink-0 text-slate-500">${formatBytes(file.size)}</span></div>`;
  compressButton.disabled = false; compressButton.textContent = 'Compress video'; result.classList.add('hidden'); message.textContent = 'Ready to compress.'; setProgress(0, 'Ready');
};
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-50'));
dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-50'); showFile(event.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => showFile(fileInput.files[0]));

const loadEngine = async () => {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    status.textContent = 'Loading engine…'; status.className = 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700';
    ffmpeg = createFFmpeg({ log: false, corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js', progress: ({ ratio }) => setProgress(ratio * 100, 'Compressing…') });
    await ffmpeg.load(); status.textContent = 'Engine ready'; status.className = 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'; return ffmpeg;
  })().catch((error) => { enginePromise = null; status.textContent = 'Engine failed'; status.className = 'rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700'; throw error; });
  return enginePromise;
};
const buildArguments = () => {
  const args = ['-i', 'input.mp4', '-c:v', 'libx264', '-crf', $('quality').value, '-preset', $('preset').value];
  const resolution = $('resolution').value; if (resolution !== 'original') args.push('-vf', `scale=-2:min(${resolution}\\,ih)`);
  const fps = $('fps').value; if (fps !== 'original') args.push('-r', fps);
  const audio = $('audio').value; if (audio === '0') args.push('-an'); else args.push('-c:a', 'aac', '-b:a', audio);
  args.push('-movflags', '+faststart', '-y', 'compressed.mp4'); return args;
};
compressButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  compressButton.disabled = true; result.classList.add('hidden'); message.textContent = 'Preparing compression engine…'; setProgress(0, 'Loading…');
  try {
    const engine = await loadEngine(); message.textContent = 'Compressing locally. Keep this tab open…';
    engine.FS('writeFile', 'input.mp4', await fetchFile(selectedFile)); await engine.run(...buildArguments());
    const data = engine.FS('readFile', 'compressed.mp4'), blob = new Blob([data.buffer], { type: 'video/mp4' }), url = URL.createObjectURL(blob);
    const savedName = `${selectedFile.name.replace(/\.mp4$/i, '')}_compressed.mp4`, savings = Math.max(0, Math.round((1 - blob.size / selectedFile.size) * 100));
    result.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-semibold text-emerald-800">Compression complete</p><p class="mt-1 text-sm text-emerald-700">${formatBytes(selectedFile.size)} → ${formatBytes(blob.size)} (${savings}% smaller)</p></div><a class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" href="${url}" download="${savedName}">Download MP4</a></div>`;
    result.classList.remove('hidden'); message.textContent = 'Your compressed video is ready.'; setProgress(100, 'Complete'); engine.FS('unlink', 'input.mp4'); engine.FS('unlink', 'compressed.mp4');
  } catch (error) { console.error(error); message.textContent = 'Compression failed. Try a smaller video or a modern browser.'; setProgress(0, 'Failed'); }
  finally { compressButton.disabled = false; }
});
