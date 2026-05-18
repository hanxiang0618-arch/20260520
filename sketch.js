let capture;
let hands;
let predictions = []; // 儲存偵測到的手部資料

// 遊戲變數
let gameState = 'WAITING'; // WAITING, COUNTING, RESULT, SERIES_OVER
let timer = 3;
let lastTick = 0;
let playerChoice = "";
let computerChoice = "";
let gameResult = "";
let playerScore = 0;
let computerScore = 0;

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
  
  // --- 鏡像處理攝影機影像 ---
  push();
  translate(x + videoW, y); // 移到影像區域的右側
  scale(-1, 1);            // 水平翻轉
  image(capture, x, y, videoW, videoH);
  pop();

  // 初始化手勢變數，稍後在狀態機中視情況進行偵測
  let currentGesture = "";
  
  // --- 畫出計分板 ---
  drawScoreboard();

  // 遊戲邏輯狀態機
  push();
  fill(50);
  stroke(0);
  strokeWeight(2);
  textAlign(CENTER, CENTER);

  if (gameState === 'SERIES_OVER') {
    textSize(60);
    let winner = playerScore >= 3 ? "🏆 你獲得最終勝利！" : "💀 電腦獲得最終勝利...";
    fill(playerScore >= 3 ? '#d62828' : '#333');
    text(winner, width / 2, height / 2);
    textSize(24);
    fill(50);
    text("👍 比讚重新開始系列賽", width / 2, height * 0.85);
    if (currentGesture === "Thumbs Up") {
      resetSeries();
    }
  }
  else if (gameState === 'WAITING') {
    textSize(50);
    if (predictions.length > 0) {
      currentGesture = detectGestures(predictions[0]);
      drawDetectionHUD(currentGesture); // 顯示偵測狀態
    }
    text("👍 比讚開始遊戲", width / 2, height * 0.15);
    if (currentGesture === "Thumbs Up") {
      gameState = 'COUNTING';
      timer = 3;
      lastTick = millis();
    }
  } 
  else if (gameState === 'COUNTING') {
    textSize(100);
    let elapsed = millis() - lastTick;
    if (timer > 0 && elapsed > 1000) {
      timer--;
      lastTick = millis();
    }

    if (timer > 0) {
      text(timer, width / 2, height / 2);
    } else {
      // 倒數結束，此時才開始偵測手勢
      if (predictions.length > 0) {
        currentGesture = detectGestures(predictions[0]);
        drawDetectionHUD(currentGesture);
      }
      textSize(60);
      text("請出拳！", width / 2, height / 2);
      if (currentGesture === "Rock" || currentGesture === "Paper" || currentGesture === "Scissors") {
        computerChoice = random(['Rock', 'Paper', 'Scissors']);
        playerChoice = currentGesture;
        gameResult = judge(playerChoice, computerChoice);
        
        // 更新分數
        if (gameResult === "你贏了！") playerScore++;
        if (gameResult === "你輸了...") computerScore++;
        
        gameState = playerScore >= 3 || computerScore >= 3 ? 'SERIES_OVER' : 'RESULT';
      }
    }
  } 
  else if (gameState === 'RESULT') {
    if (predictions.length > 0) {
      currentGesture = detectGestures(predictions[0]);
    }
    textSize(40);
    let displayPlayer = translateToChinese(playerChoice);
    let displayComputer = translateToChinese(computerChoice);
    
    text(`你 [${displayPlayer}]  vs  電腦 [${displayComputer}]`, width / 2, height * 0.15);
    textSize(70);
    fill(gameResult === "你贏了！" ? '#d62828' : 50);
    text(gameResult, width / 2, height / 2);
    
    textSize(24);
    fill(50);
    text("👍 再比一次讚重玩", width / 2, height * 0.85);
    
    if (currentGesture === "Thumbs Up") {
      gameState = 'WAITING';
    }
  }
  pop();

  // 畫出手部關節點
  drawLandmarks(x, y, videoW, videoH);
}

function drawDetectionHUD(gesture) {
  if (gesture === "Rock" || gesture === "Paper" || gesture === "Scissors") {
    push();
    fill(0, 100, 255);
    stroke(0);
    strokeWeight(2);
    textSize(24);
    textAlign(CENTER, TOP);
    // 確保文字不會超出螢幕
    text(`目前偵測：${translateToChinese(gesture)}`, width / 2, height * 0.05);
    pop();
  }
}

function drawScoreboard() {
  push();
  rectMode(CENTER);
  fill(255, 200);
  noStroke();
  rect(width / 2, 70, 300, 60, 10);
  fill(0);
  textSize(24);
  textAlign(CENTER, CENTER);
  text(`玩家 ${playerScore} : ${computerScore} 電腦`, width / 2, 70);
  pop();
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
        // 因為影像鏡像了，所以 x 座標要用 (1 - pt.x) 來映射
        let px = (1 - pt.x) * videoW + offsetX;
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

function resetSeries() {
  playerScore = 0;
  computerScore = 0;
  gameState = 'WAITING';
}

// 當視窗縮放時，自動調整畫布大小以維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
