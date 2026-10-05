export function createAvatarOutputPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NEB Avatar</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101416}img{width:100%;height:100%;object-fit:contain;visibility:hidden}
</style></head><body><img alt=""><script>
const image=document.querySelector('img'),query=new URLSearchParams(location.search);query.set('viewer',crypto.randomUUID());
let last=0,retry=null,streaming=false;
function neutral(){image.style.visibility='hidden';image.removeAttribute('src');streaming=false;}
function connectVideo(){if(streaming)return;streaming=true;image.src='/video?'+query;}
image.onerror=()=>{neutral();clearTimeout(retry);retry=setTimeout(connectVideo,1000);};
const events=new EventSource('/events?'+query);
events.onmessage=(event)=>{const state=JSON.parse(event.data);last=Date.now();if(state.active){connectVideo();image.style.visibility='visible';}else{clearTimeout(retry);neutral();}};
events.onerror=()=>{last=0;neutral();};
setInterval(()=>{if(!last||Date.now()-last>3000)neutral();},250);
addEventListener('pagehide',()=>{events.close();clearTimeout(retry);neutral();});
</script></body></html>`
}
