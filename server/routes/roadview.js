const express = require('express');

const router = express.Router();

// 좌표 기준 가장 가까운 카카오 로드뷰를 띄우는 HTML 페이지.
// 앱에서 iframe(웹) 또는 인앱 브라우저(네이티브)로 임베드해서 사용한다.
router.get('/roadview', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const key = process.env.KAKAO_JS_KEY;
  // 실제 서버가 쓰는 키를 안전하게(중간 가림) 화면에 노출해 진단
  const maskedKey = key ? `${key.slice(0, 6)}…${key.slice(-4)} (len ${key.length})` : '(none)';

  res.set('Content-Type', 'text/html; charset=utf-8');

  const message = (text) => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{margin:0;height:100%}.msg{height:100%;display:flex;align-items:center;justify-content:center;
color:#8b8b8b;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;text-align:center;padding:20px;box-sizing:border-box;background:#111}</style>
</head><body><div class="msg">${text}</div></body></html>`;

  if (!key) {
    return res.send(message('로드뷰 준비 중이에요'));
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.send(message('위치 정보가 없어요'));
  }

  res.send(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html,body,#rv{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}
  .msg{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9a9a9a;
       font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13.5px;text-align:center;padding:20px;box-sizing:border-box;line-height:1.5}
  .dbg{margin-top:14px;font-size:11px;color:#5f5f5f;max-width:100%;word-break:break-all;white-space:pre-wrap}
</style>
</head><body>
<div id="rv"></div>
<script>
  var lat=${lat}, lng=${lng};
  var done=false;
  var sdkState='pending'; // pending | loaded | error
  var logs=[];
  function pushLog(kind, args){ try{ logs.push(kind+': '+Array.prototype.map.call(args,function(a){return (a&&a.message)||String(a);}).join(' ')); }catch(e){} }
  var _err=console.error; console.error=function(){ pushLog('kakao', arguments); _err.apply(console, arguments); };
  var _warn=console.warn; console.warn=function(){ pushLog('warn', arguments); _warn.apply(console, arguments); };
  window.addEventListener('error', function(ev){ pushLog('js', [ev.message||ev.type]); });

  var maskedKey='${maskedKey}';
  function fail(msg){
    if(done) return; done=true;
    var info = 'appkey='+maskedKey+'\\norigin='+location.origin;
    var extra = '<div class="dbg">'+(logs.length?logs.slice(0,4).join('\\n')+'\\n':'')+info+'</div>';
    var c=document.getElementById('rv'); if(c){ c.innerHTML='<div class="msg">'+msg+extra+'</div>'; }
  }
  function ok(){ done=true; }

  function start(){
    var container=document.getElementById('rv');
    var pos=new kakao.maps.LatLng(lat,lng);
    var roadview=new kakao.maps.Roadview(container);
    var client=new kakao.maps.RoadviewClient();
    client.getNearestPanoId(pos, 150, function(panoId){
      if(panoId===null){ fail('이 위치는 로드뷰가 없어요'); }
      else { ok(); roadview.setPanoId(panoId, pos); }
    });
  }

  // kakao 네임스페이스가 준비될 때까지 최대 10초 폴링 (비동기 로드 대응)
  var waited=0;
  var poll=setInterval(function(){
    if(done){ clearInterval(poll); return; }
    if(window.kakao && window.kakao.maps && typeof window.kakao.maps.load==='function'){
      clearInterval(poll);
      try{
        kakao.maps.load(function(){ try{ start(); }catch(e){ fail('로드뷰 표시 오류: '+(e&&e.message||e)); } });
      }catch(e){ fail('SDK load 오류: '+(e&&e.message||e)); }
    }else{
      waited += 200;
      if(waited>=10000){
        clearInterval(poll);
        var why = sdkState==='error'
          ? '카카오가 SDK 요청을 거부했어요 (HTTP 오류)<br>[앱 설정 &gt; 플랫폼 &gt; Web &gt; 사이트 도메인]에 등록됐는지 확인'
          : sdkState==='loaded'
            ? 'SDK는 받았는데 초기화가 안 됐어요<br>카카오맵 사용 설정/도메인을 확인'
            : 'SDK 응답이 없어요 (네트워크/도메인 차단)';
        fail(why + '<div class="dbg">sdkState=' + sdkState + '</div>');
      }
    }
  }, 200);

  // load 콜백이 끝내 안 오는 경우(도메인 거부 등) 대비한 최종 가드
  setTimeout(function(){ if(!done){ fail('지도 SDK 초기화가 끝나지 않았어요<br>도메인 등록/키를 확인해 주세요<div class="dbg">sdkState='+sdkState+'</div>'); } }, 14000);
</script>
<script
  src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false"
  onload="sdkState='loaded'"
  onerror="sdkState='error'; pushLog('sdk',['스크립트 요청 실패 — 도메인/키 거부'])"
></script>
</body></html>`);
});

module.exports = router;
