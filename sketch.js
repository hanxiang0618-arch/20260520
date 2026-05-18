let capture;
let hands;
let predictions = []; // 儲存偵測到的手部資料

// 遊戲變數
let gameState = 'WAITING'; // WAITING, COUNTING, RESULT
let timer = 3;
let lastTick = 0;
let playerChoice = "";
let computerChoice = "";
let gameResult = "";

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

  // 取得目前偵測到的手勢
  let currentGesture = "";
  if (predictions.length > 0) {
    currentGesture = detectGestures(predictions[0]);
  }

  // 遊戲邏輯狀態機
  push();
  fill(255);
  stroke(0);
  strokeWeight(4);
  textSize(60);
  textAlign(CENTER, CENTER);

  if (gameState === 'WAITING') {
    text("👍 比讚開始遊戲", width / 2, height * 0.15);
    if (currentGesture === "Thumbs Up") {
      gameState = 'COUNTING';
      timer = 3;
      lastTick = millis();
    }
  } 
  else if (gameState === 'COUNTING') {
    let elapsed = millis() - lastTick;
    if (elapsed > 1000) {
      timer--;
      lastTick = millis();
    }
    if (timer > 0) {
      text(timer, width / 2, height / 2);
    } else {
      // 時間到，判定勝負
      computerChoice = random(['Rock', 'Paper', 'Scissors']);
      playerChoice = (currentGesture === "Rock" || currentGesture === "Paper" || currentGesture === "Scissors") ? currentGesture : "Unknown";
      gameResult = judge(playerChoice, computerChoice);
      gameState = 'RESULT';
    }
  } 
  else if (gameState === 'RESULT') {
    textSize(40);
    let displayPlayer = translateToChinese(playerChoice);
    let displayComputer = translateToChinese(computerChoice);
    
    text(`你出: ${displayPlayer}  vs  電腦出: ${displayComputer}`, width / 2, height * 0.15);
    textSize(80);
    fill(gameResult === "你贏了！" ? '#ff0000' : 255);
    text(gameResult, width / 2, height / 2);
    
    textSize(30);
    fill(255);
    text("👍 再比一次讚重玩", width / 2, height * 0.85);
    
    if (currentGesture === "Thumbs Up") {
      gameState = 'WAITING';
    }
  }
  pop();

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

function detectGestures(landmarks) {
  // 判斷手指是否伸直 (在 MediaPipe 中，Y 座標 0 為頂部，1 為底部)
  // 邏輯：指尖的 Y 比第二關節的 Y 小，代表手指向上伸出
  let indexOpen = landmarks[8].y < landmarks[6].y;
  let middleOpen = landmarks[12].y < landmarks[10].y;
  let ringOpen = landmarks[16].y < landmarks[14].y;
  let pinkyOpen = landmarks[20].y < landmarks[18].y;

  // 拇指伸開判斷
  let thumbOpen = dist(landmarks[4].x, landmarks[4].y, landmarks[5].x, landmarks[5].y) > 
                  dist(landmarks[3].x, landmarks[3].y, landmarks[5].x, landmarks[5].y);

  // 1. 布 (Paper): 四指皆開
  if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
    return "Paper";
  } 
  // 2. 剪刀 (Scissors): 食中開，無名小指關
  else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
    return "Scissors";
  } 
  // 3. 伸食指 (Pointing): 僅食指開
  else if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return "Pointing";
  } 
  // 4. 當四指都握住時
  else if (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    // 檢查大拇指是否向上 (比讚)
    if (landmarks[4].y < landmarks[3].y && landmarks[4].y < landmarks[2].y) {
      return "Thumbs Up";
    } else {
      return "Rock";
    }
  }
  return "";
}

// 勝負判定
function judge(p, c) {
  if (p === "Unknown") return "沒偵測到出手！";
  if (p === c) return "平手 (Tie)";
  
  if (
    (p === "Rock" && c === "Scissors") ||
    (p === "Paper" && c === "Rock") ||
    (p === "Scissors" && c === "Paper")
  ) {
    return "你贏了！";
  } else {
    return "你輸了...";
  }
}

// 輔助文字翻譯
function translateToChinese(gesture) {
  switch(gesture) {
    case "Rock": return "石頭";
    case "Paper": return "布";
    case "Scissors": return "剪刀";
    case "Unknown": return "未知";
    default: return "";
  }
}

// 當視窗縮放時，自動調整畫布大小以維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
