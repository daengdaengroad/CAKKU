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
  .msg{height:100%;display:flex;align-items:center;justify-content:center;color:#8b8b8b;
       font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13.5px;text-align:center;padding:20px;box-sizing:border-box;line-height:1.5}
</style>
</head><body>
<div id="rv"></div>
<script>
  var lat=${lat}, lng=${lng};
  function fail(msg){ var c=document.getElementById('rv'); if(c){ c.innerHTML='<div class="msg">'+msg+'</div>'; } }
  // SDK가 15초 안에 안 뜨면(도메인 차단 등으로 스크립트가 막힌 경우) 안내
  var sdkTimer=setTimeout(function(){ if(!window.kakao||!window.kakao.maps){ fail('지도 SDK를 불러오지 못했어요<br>카카오 개발자센터에서 이 사이트 도메인 등록을 확인해 주세요'); } }, 15000);
  function onSdkError(){ clearTimeout(sdkTimer); fail('지도 SDK 요청이 거부됐어요<br>JS 키의 사이트 도메인(플랫폼 &gt; Web) 등록을 확인해 주세요'); }
</script>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services" onerror="onSdkError()"></script>
<script>
  (function(){
    clearTimeout(sdkTimer);
    if(!window.kakao||!window.kakao.maps){
      fail('지도 SDK가 초기화되지 않았어요<br>JS 키의 사이트 도메인(플랫폼 &gt; Web) 등록을 확인해 주세요');
      return;
    }
    try{
      kakao.maps.load(function(){
        try{
          var container=document.getElementById('rv');
          var pos=new kakao.maps.LatLng(lat,lng);
          var roadview=new kakao.maps.Roadview(container);
          var client=new kakao.maps.RoadviewClient();
          client.getNearestPanoId(pos, 150, function(panoId){
            if(panoId===null){ fail('이 위치는 로드뷰가 없어요'); }
            else { roadview.setPanoId(panoId, pos); }
          });
        }catch(e){ fail('로드뷰 표시 오류: '+(e&&e.message||e)); }
      });
    }catch(e){ fail('SDK 로드 오류: '+(e&&e.message||e)); }
  })();
</script>
</body></html>`);
});

module.exports = router;
