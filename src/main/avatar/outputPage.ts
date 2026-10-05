export function createAvatarOutputPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NEB Avatar</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101416}img{width:100%;height:100%;object-fit:contain;visibility:hidden}
</style></head><body><img alt=""><script>
const image=document.querySelector('img'),query=new URLSearchParams(location.search);query.set('viewer',crypto.randomUUID());
let last=0,active=false,decoding=false,pending=null;
function neutral(){active=false;decoding=false;pending=null;image.style.visibility='hidden';image.removeAttribute('src');}
function show(jpeg){decoding=true;image.src='data:image/jpeg;base64,'+jpeg;}
function finish(){decoding=false;if(active&&pending){const jpeg=pending;pending=null;show(jpeg);}}
image.onload=()=>{if(active)image.style.visibility='visible';finish();};
image.onerror=finish;
const events=new EventSource('/events?'+query);
events.onmessage=(event)=>{const state=JSON.parse(event.data);last=Date.now();if(state.active){active=true;if(state.jpeg){if(decoding)pending=state.jpeg;else show(state.jpeg);}}else neutral();};
events.onerror=()=>{last=0;neutral();};
setInterval(()=>{if(!last||Date.now()-last>3000)neutral();},250);
addEventListener('pagehide',()=>{events.close();neutral();});
</script></body></html>`
}
