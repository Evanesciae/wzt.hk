export {};
const root=document.querySelector<HTMLElement>('.library')!;
const courseId=root.dataset.course??'',folderId=root.dataset.folder??'';
const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content??'';
const feedback=document.querySelector<HTMLElement>('#library-feedback')!;
let uploading=false;
document.querySelectorAll<HTMLFormElement>('[data-library-action]').forEach(form=>form.addEventListener('submit',async event=>{
  event.preventDefault();if(uploading){feedback.textContent='请等待上传结束后再整理文件。';return;}
  const button=form.querySelector<HTMLButtonElement>('button')!;button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));const response=await fetch('/api/admin/study',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({courseId,folderId,...data,action:form.dataset.libraryAction})});const result=await response.json();if(!response.ok)throw new Error(result.error??'操作失败');location.href=form.dataset.libraryAction==='create-course'?`/admin/study?course=${encodeURIComponent(result.id)}`:location.href;}
  catch(error){feedback.textContent=error instanceof Error?error.message:'网络连接失败';button.disabled=false;}
}));
const input=document.querySelector<HTMLInputElement>('#library-files');
const zone=document.querySelector<HTMLElement>('#upload-zone');
const list=document.querySelector<HTMLElement>('#upload-list');
const retry=document.querySelector<HTMLButtonElement>('#retry-uploads');
type Entry={file:File;node:HTMLLIElement;failed:boolean};
const entries:Entry[]=[];
function upload(entry:Entry){return new Promise<void>((resolve,reject)=>{
  if(entry.file.size>25*1024*1024){reject(new Error('超过 25 MB，未上传'));return;}
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/study/upload');xhr.timeout=180000;
  xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-CSRF-Token',csrf);xhr.setRequestHeader('x-course-id',courseId);xhr.setRequestHeader('x-folder-id',folderId);xhr.setRequestHeader('x-file-name',encodeURIComponent(entry.file.name));
  xhr.upload.onprogress=e=>{entry.node.textContent=`${entry.file.name} · ${e.lengthComputable?Math.round(e.loaded/e.total*100)+'%':'上传中'}`;};
  xhr.onerror=()=>reject(new Error('网络中断，可重试'));xhr.ontimeout=()=>reject(new Error('上传超时，可重试'));
  xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(new Error('服务器未返回有效结果，可重试'));return;}if(xhr.status<200||xhr.status>=300){reject(new Error(result.error??'上传失败'));return;}entry.node.textContent=`${entry.file.name} · ${result.duplicate?'已存在相同版本':'已保存'}`;resolve();};
  xhr.send(entry.file);
});}
async function run(batch:Entry[]){
  uploading=true;if(input)input.disabled=true;if(retry)retry.hidden=true;
  document.querySelector<HTMLElement>('#upload-results')!.hidden=false;
  for(const entry of batch){entry.failed=false;try{await upload(entry);}catch(error){entry.failed=true;entry.node.textContent=`${entry.file.name} · ${error instanceof Error?error.message:'失败'}`;}}
  uploading=false;if(input)input.disabled=false;if(retry)retry.hidden=!entries.some(e=>e.failed);
  document.querySelector<HTMLElement>('#show-uploaded')!.hidden=false;
  feedback.textContent=`本次列表：${entries.filter(e=>!e.failed).length} 个已保存，${entries.filter(e=>e.failed).length} 个失败。`;
}
function add(files:File[]){if(uploading||!files.length)return;const batch=files.map(file=>{const node=document.createElement('li');node.textContent=file.name+' · 等待上传';list!.append(node);return {file,node,failed:false};});entries.push(...batch);void run(batch);}
input?.addEventListener('change',()=>{add(Array.from(input.files??[]));input.value='';});
zone?.addEventListener('dragover',event=>{event.preventDefault();zone.classList.add('dragging');});
zone?.addEventListener('dragleave',()=>zone.classList.remove('dragging'));
zone?.addEventListener('drop',event=>{event.preventDefault();zone.classList.remove('dragging');add(Array.from(event.dataTransfer?.files??[]));});
window.addEventListener('beforeunload',event=>{if(uploading){event.preventDefault();event.returnValue='';}});
retry?.addEventListener('click',()=>void run(entries.filter(e=>e.failed)));
