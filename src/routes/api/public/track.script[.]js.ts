import { createFileRoute } from "@tanstack/react-router";

// Serve o pixel JS para colar no site do cliente:
// <script async src="https://<dominio>/api/public/track/script.js?pk=pk_xxx"></script>
export const Route = createFileRoute("/api/public/track/script.js")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pk = url.searchParams.get("pk") || "";
        const endpoint = `${url.protocol}//${url.host}/api/public/track/event`;
        const js = renderPixel(endpoint, pk);
        return new Response(js, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});

function renderPixel(endpoint: string, pk: string) {
  // Captura utm_*, fbclid, gclid, gbraid, wbraid, ttclid, msclkid, referrer, page,
  // persiste em cookie + localStorage, gera session_id e envia "pageview".
  // Expõe window.zennoTrack({event, email, phone, name, value, currency}) p/ Lead/Purchase.
  return `(()=>{try{
var PK=${JSON.stringify(pk)};
var EP=${JSON.stringify(endpoint)};
if(!PK){return}
var KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_id","fbclid","gclid","gbraid","wbraid","ttclid","msclkid"];
function uuid(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c=="x"?r:(r&0x3|0x8);return v.toString(16)})}
function cookieGet(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
function cookieSet(n,v,days){var d=new Date();d.setTime(d.getTime()+days*864e5);document.cookie=n+"="+encodeURIComponent(v)+"; expires="+d.toUTCString()+"; path=/; SameSite=Lax"}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var sid=cookieGet("_ztk_sid")||lsGet("_ztk_sid")||uuid();
cookieSet("_ztk_sid",sid,365);lsSet("_ztk_sid",sid);
var qs=new URLSearchParams(location.search);var fromUrl={};var hasParam=false;
KEYS.forEach(function(k){var v=qs.get(k);if(v){fromUrl[k]=v;hasParam=true}});
var stored={};try{stored=JSON.parse(lsGet("_ztk_attr")||"{}")}catch(e){}
var attr=hasParam?fromUrl:stored;
if(hasParam){lsSet("_ztk_attr",JSON.stringify(fromUrl));cookieSet("_ztk_attr",JSON.stringify(fromUrl),90)}
function send(name,extra){
  var body=Object.assign({
    pk:PK,session_id:sid,event_name:name,
    page:location.href,referrer:document.referrer||null,
    page_title:document.title||null
  },attr,extra||{});
  try{
    var blob=new Blob([JSON.stringify(body)],{type:"application/json"});
    if(navigator.sendBeacon){navigator.sendBeacon(EP,blob);return}
  }catch(e){}
  fetch(EP,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true}).catch(function(){})
}
window.zennoTrack=function(opts){opts=opts||{};send(opts.event||"custom",opts)};
window.zennoSession=function(){return sid};
send("pageview");
}catch(e){}})();`;
}
