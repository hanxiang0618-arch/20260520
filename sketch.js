let capture;
let hands;
let predictions = []; // 儲存偵測到的手部資料

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  
  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  
  // 隱藏預設產生的 HTML5 video 元件，只在 canvas 裡面繪製
  capture.hide();

  // 初始化 MediaPipe Hands
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // 當模型完成偵測時的處理函式
  hands.onResults(onResults);

  // 使用 MediaPipe 的 Camera 輔助工具來建立 30 FPS 循環
  const camera = new Camera(capture.elt, {
    onFrame: async () => {
      await hands.send({ image: capture.elt });
    },
    width: 640,
    height: 480
  });
  camera.start();
}

function draw() {
  // 設定背景顏色
  background('#e7c6ff');
  
  // 計算影像的寬與高 (全螢幕寬高的 60%)
  let videoW = width * 0.6;
  let videoH = height * 0.6;
  
  // 計算置中座標
  let x = (width - videoW) / 2;
  let y = (height - videoH) / 2;
  
  // 將攝影機影像繪製在畫面上
  image(capture, x, y, videoW, videoH);

  // 畫出手部關節點
  drawLandmarks(x, y, videoW, videoH);
}

function onResults(results) {
  predictions = results.multiHandLandmarks;
}

function drawLandmarks(offsetX, offsetY, videoW, videoH) {
  if (predictions.length > 0) {
    for (let landmarks of predictions) {
      // 設定點的顏色
      fill(0, 255, 0);
      noStroke();
      
      for (let i = 0; i < landmarks.length; i++) {
        let pt = landmarks[i];
        
        // MediaPipe 的座標是 0~1 的比例，需要映射到我們顯示的 60% 區塊
        // 注意：攝影機影像通常是水平反轉的，若需要鏡像請調整 mapping
        let px = pt.x * videoW + offsetX;
        let py = pt.y * videoH + offsetY;
        
        circle(px, py, 8); // 畫出直徑 8 的圓點
      }
    }
  }
}

// 當視窗縮放時，自動調整畫布大小以維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
