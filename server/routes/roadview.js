const express = require('express');

const router = express.Router();

// 좌표 기준 가장 가까운 카카오 로드뷰를 띄우는 HTML 페이지.
// 앱에서 iframe(웹) 또는 인앱 브라우저(네이티브)로 임베드해서 사용한다.
router.get('/roadview', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const key = process.env.KAKAO_JS_KEY;

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
  .msg{height:100%;display:flex;align-items:center;justify-content:center;color:#9a9a9a;
       font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13.5px;text-align:center;padding:20px;box-sizing:border-box;line-height:1.5}
</style>
</head><body>
<div id="rv"></div>
<script>
  var lat=${lat}, lng=${lng};
  var done=false;
  function fail(msg){
    if(done) return; done=true;
    var c=document.getElementById('rv'); if(c){ c.innerHTML='<div class="msg">'+msg+'</div>'; }
  }
  function start(){
    var container=document.getElementById('rv');
    var pos=new kakao.maps.LatLng(lat,lng);
    var roadview=new kakao.maps.Roadview(container);
    var client=new kakao.maps.RoadviewClient();
    client.getNearestPanoId(pos, 150, function(panoId){
      if(panoId===null){ fail('이 위치는 로드뷰가 없어요'); }
      else { done=true; roadview.setPanoId(panoId, pos); }
    });
  }
  // kakao 네임스페이스가 준비될 때까지 최대 10초 폴링 (비동기 로드 대응)
  var waited=0;
  var poll=setInterval(function(){
    if(done){ clearInterval(poll); return; }
    if(window.kakao && window.kakao.maps && typeof window.kakao.maps.load==='function'){
      clearInterval(poll);
      try{
        kakao.maps.load(function(){ try{ start(); }catch(e){ fail('로드뷰를 불러올 수 없어요'); } });
      }catch(e){ fail('로드뷰를 불러올 수 없어요'); }
    }else{
      waited += 200;
      if(waited>=10000){ clearInterval(poll); fail('로드뷰를 불러올 수 없어요'); }
    }
  }, 200);
</script>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false"
        onerror="(function(){var c=document.getElementById('rv');if(c){c.innerHTML='<div class=&quot;msg&quot;>로드뷰를 불러올 수 없어요</div>';}})()"></script>
</body></html>`);
});

module.exports = router;
