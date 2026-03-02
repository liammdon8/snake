const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const pauseScreen = document.getElementById('pause-screen');
const rageIndicator = document.getElementById('rage-indicator');
const rageTimerEl = document.getElementById('rage-timer');
const rageCoverageEl = document.getElementById('rage-coverage');
const victoryScreen = document.getElementById('victory-screen');
const victoryScoreValue = document.getElementById('victory-score-value');
const victoryRestartBtn = document.getElementById('victory-restart-btn');
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;

// 移动端控件
const mobileControlArea = document.getElementById('mobile-control-area');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const joystickContainer = document.getElementById('joystick-container');
const dpadContainer = document.getElementById('dpad-container');
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');

// 虚拟按键元素
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// 游戏常量和变量
const GRID_SIZE = 20;
let TILE_COUNT_X, TILE_COUNT_Y;
let GAME_SPEED = 180; // 调整后的基准速度（更平缓）

// 检测移动设备
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

// 端能力配置
const config = {
    allowModeSwitch: true,     // 允许所有端切换模式
    enableNPC: true,           // 默认开启 NPC
};

const MOVE_MODE = {
    GRID: 'grid',
    FREE: 'free'
};

let currentMode = MOVE_MODE.GRID; // 初始为网格模式

// 颜色主题
const COLORS = {
    playerHead: '#ffffff',
    playerBody: ['#ff3131', '#ff5e13', '#ffff31', '#00f0ff', '#0045ff', '#7000ff', '#ff00ff'], 
    food: '#ff0055',
    grid: 'rgba(255, 255, 255, 0.03)',
    gridWeak: 'rgba(255, 255, 255, 0.01)', // 模式二下的弱化网格
    npcHead: '#ffffff', 
    npcBody: '#8e8e8e'  
};

let snake = [];
let foods = []; 
let npcs = []; 
let dx = 0;
let dy = 0;
let angle = 0; // 自由模式下的角度
let moveSpeed = 5; // 自由模式下的每步像素
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoop;
let npcSpawnInterval;
let isGameOver = false;
let isPaused = false;
let hasStarted = false;
let changingDirection = false;
let controlMode = 'dpad';

// 狂暴模式变量
let isRageMode = false;
let rageTimer = null;
let rageStartTime = 0;
const RAGE_DURATION = 15000;
const RAGE_GRID_SPEED = 25;
const RAGE_FREE_SPEED = 16;

// 三击检测
let tapTimestamps = [];
let lastTapTime = 0;
const TRIPLE_TAP_WINDOW = 800;
const TRIPLE_TAP_COUNT = 3;

// AI路径
let ragePhase = 'eat'; // 'eat' or 'fill'
let rageFillPath = [];
let rageFillIndex = 0;
let rageSweepDir = 1; // 自由模式扫描方向
let rageSweepY = 20; // 自由模式扫描当前Y

// 撒花 & 胜利
let confettiParticles = [];
let confettiAnimFrame = null;
let isVictoryShown = false;

// 速度备份
let savedGameSpeed = 0;
let savedMoveSpeed = 0;

// 摇杆变量
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
let joystickTouchId = null;

// 初始化
if (highScoreElement) highScoreElement.textContent = highScore;
setupMobileControls();
handleResize(); 

// 监听窗口大小变化
window.addEventListener('resize', handleResize);

// 按键监听
document.addEventListener('keydown', handleKeyPress);
restartBtn.addEventListener('click', resetGame);
startBtn.addEventListener('click', startGame);
if (victoryRestartBtn) victoryRestartBtn.addEventListener('click', resetFromVictory);

// 添加触摸支持到按钮上
[restartBtn, startBtn, victoryRestartBtn].forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
        // e.preventDefault(); 
    }, { passive: true });
});

function handleResize() {
    // 更新移动端控件显示状态
    if (typeof updateMobileControlVisibility === 'function') {
        updateMobileControlVisibility();
    } else {
        // Fallback if function not yet defined
        if (window.innerWidth <= 768) {
             if (mobileControlArea) mobileControlArea.classList.remove('hidden');
        }
    }

    // 动态设置 canvas 尺寸
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // 设置物理分辨率以保证清晰度
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // 设置 CSS 显示大小
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // 缩放上下文，使绘图指令继续使用逻辑像素（CSS 像素）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    TILE_COUNT_X = rect.width / GRID_SIZE;
    TILE_COUNT_Y = rect.height / GRID_SIZE;

    // 如果游戏正在运行且尺寸变化过大，需要重置一下网格渲染
    if (hasStarted && !isGameOver) {
        drawGrid();
        drawFoods();
        drawSnake();
        if (config.enableNPC) drawNPCs();
    } else {
        clearCanvas();
        drawGrid();
    }
}

function initGame() {
    // 清理狂暴模式状态
    if (isRageMode) deactivateRageMode();
    isRageMode = false;
    ragePhase = 'eat';
    rageFillPath = [];
    rageFillIndex = 0;
    isVictoryShown = false;
    tapTimestamps = [];
    if (rageTimer) { clearTimeout(rageTimer); rageTimer = null; }
    if (victoryScreen) victoryScreen.classList.add('hidden');
    stopConfetti();
    GAME_SPEED = 180;

    if (currentMode === MOVE_MODE.GRID) {
        // 模式一：网格逻辑
        const centerX = Math.floor(TILE_COUNT_X / 2);
        const centerY = Math.floor(TILE_COUNT_Y / 2);
        snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY }
        ];
        dx = 1; dy = 0;
    } else {
        // 模式二：自由移动逻辑
        const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
        const logicalHeight = canvas.height / (window.devicePixelRatio || 1);
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        snake = [];
        // 初始长度
        for (let i = 0; i < 15; i++) {
            snake.push({ x: centerX - i * 5, y: centerY });
        }
        angle = 0; 
        moveSpeed = 5; // 提高基础速度
    }
    
    score = 0;
    scoreElement.textContent = score;
    isGameOver = false;
    isPaused = false;
    pauseScreen.classList.add('hidden');
    changingDirection = false;
    
    foods = [];
    npcs = [];
    
    // 生成初始食物和NPC
    const initialFoodCount = currentMode === MOVE_MODE.FREE ? 10 : 5;
    for(let i=0; i < initialFoodCount; i++) spawnFood();
    
    if (config.enableNPC) {
        spawnNPC(2); // 初始2条NPC
        
        if (npcSpawnInterval) clearInterval(npcSpawnInterval);
        npcSpawnInterval = setInterval(() => {
            if (!isGameOver && !isPaused && npcs.length < 5) spawnNPC(2);
        }, 15000); 
    } else {
        npcs = [];
        if (npcSpawnInterval) clearInterval(npcSpawnInterval);
    }
}

function startGame() {
    startScreen.classList.add('hidden');
    hasStarted = true;
    initGame();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(main, GAME_SPEED);
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    initGame();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(main, GAME_SPEED);
}

function main() {
    if (isGameOver || isPaused) return;

    changingDirection = false;

    // 狂暴模式AI控制
    if (isRageMode && !isVictoryShown) {
        if (currentMode === MOVE_MODE.GRID) {
            const dir = getRageDirectionGrid();
            if (dir) { dx = dir.dx; dy = dir.dy; }
        } else {
            angle = getRageDirectionFree();
        }

        // 自动补充食物
        if (foods.length < 5) {
            for (let i = 0; i < 5; i++) spawnFood();
        }

        // 检查覆盖率
        const coverage = calculateCoverage();
        if (coverage >= 0.75) {
            triggerUltimateVictory();
            return;
        }

        // 更新指示器
        updateRageIndicator(coverage);
    }

    // 移动并检测
    moveSnake();

    // NPC 逻辑受开关控制 (狂暴期间跳过)
    if (config.enableNPC && !isRageMode) {
        moveNPCs();
        checkNPCCollisions();
    }

    checkGameOver(); // 检查玩家是否死亡

    if (isGameOver) {
        handleGameOver();
        return;
    }

    // 渲染
    clearCanvas();
    drawGrid();
    drawFoods();
    if (config.enableNPC && !isRageMode) drawNPCs();
    drawSnake();

    // 狂暴模式红色渐晕
    if (isRageMode) {
        drawRageVignette();
    }
}

function clearCanvas() {
    // 由于使用了 dpr 缩放，这里清空逻辑坐标系下的全屏区域
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
}

function drawGrid() {
    const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
    const logicalHeight = canvas.height / (window.devicePixelRatio || 1);
    
    ctx.strokeStyle = currentMode === MOVE_MODE.FREE ? COLORS.gridWeak : COLORS.grid;
    ctx.lineWidth = 1;
    
    // 绘制垂直线
    for (let i = 0; i <= logicalWidth; i += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, logicalHeight);
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let j = 0; j <= logicalHeight; j += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(logicalWidth, j);
        ctx.stroke();
    }
}

function drawSnake() {
    drawGenericSnake(snake, COLORS.playerHead, COLORS.playerBody, dx, dy, true);
}

function drawNPCs() {
    npcs.forEach((npc, index) => {
        drawGenericSnake(npc.body, COLORS.npcHead, COLORS.npcBody, npc.dx, npc.dy, false);
    });
}

function drawGenericSnake(snakeBody, headColor, bodyColor, currentDx, currentDy, isPlayer) {
    snakeBody.forEach((segment, index) => {
        const isHead = index === 0;

        // 玩家使用彩色数组循环，NPC 使用固定银色
        let color;
        if (isRageMode && isPlayer) {
            // 狂暴模式：彩虹渐变色
            const hue = (Date.now() / 10 + index * 12) % 360;
            color = `hsl(${hue}, 100%, 55%)`;
        } else if (isHead) {
            color = headColor;
        } else if (Array.isArray(bodyColor)) {
            color = bodyColor[(index - 1) % bodyColor.length];
        } else {
            color = bodyColor;
        }

        // 绘制发光效果
        const baseBlur = isHead ? 15 : (isPlayer ? 10 : 8);
        ctx.shadowBlur = (isRageMode && isPlayer) ? baseBlur * 2 : baseBlur;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        
        ctx.beginPath();
        if (currentMode === MOVE_MODE.GRID) {
            // 网格模式：圆角矩形
            ctx.roundRect(
                segment.x * GRID_SIZE + 1, 
                segment.y * GRID_SIZE + 1, 
                GRID_SIZE - 2, 
                GRID_SIZE - 2, 
                5
            );
        } else {
            // 自由模式：圆形
            const radius = isHead ? 10 : 8;
            ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
        }
        ctx.fill();
        
        // 如果是头部，画眼睛
        if (isHead) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            
            let eye1X, eye1Y, eye2X, eye2Y;
            const eyeSize = 3;
            
            if (currentMode === MOVE_MODE.GRID) {
                const offset = 4;
                // 根据方向调整眼睛位置
                if (currentDx === 1) { // 右
                    eye1X = eye2X = segment.x * GRID_SIZE + GRID_SIZE - 6;
                    eye1Y = segment.y * GRID_SIZE + offset;
                    eye2Y = segment.y * GRID_SIZE + GRID_SIZE - offset - eyeSize;
                } else if (currentDx === -1) { // 左
                    eye1X = eye2X = segment.x * GRID_SIZE + 6 - eyeSize;
                    eye1Y = segment.y * GRID_SIZE + offset;
                    eye2Y = segment.y * GRID_SIZE + GRID_SIZE - offset - eyeSize;
                } else if (currentDy === -1) { // 上
                    eye1Y = eye2Y = segment.y * GRID_SIZE + 6 - eyeSize;
                    eye1X = segment.x * GRID_SIZE + offset;
                    eye2X = segment.x * GRID_SIZE + GRID_SIZE - offset - eyeSize;
                } else { // 下
                    eye1Y = eye2Y = segment.y * GRID_SIZE + GRID_SIZE - 6;
                    eye1X = segment.x * GRID_SIZE + offset;
                    eye2X = segment.x * GRID_SIZE + GRID_SIZE - offset - eyeSize;
                }
                ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
                ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);
            } else {
                // 自由模式：眼神随当前角度动
                const currentAngle = isPlayer ? angle : (segment.angle || 0);
                const eyeOffset = 6;
                const eyeSpread = 0.5;
                eye1X = segment.x + Math.cos(currentAngle - eyeSpread) * eyeOffset;
                eye1Y = segment.y + Math.sin(currentAngle - eyeSpread) * eyeOffset;
                eye2X = segment.x + Math.cos(currentAngle + eyeSpread) * eyeOffset;
                eye2Y = segment.y + Math.sin(currentAngle + eyeSpread) * eyeOffset;
                
                ctx.beginPath();
                ctx.arc(eye1X, eye1Y, eyeSize/2, 0, Math.PI*2);
                ctx.arc(eye2X, eye2Y, eyeSize/2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    });
    ctx.shadowBlur = 0;
}

function moveSnake() {
    let head;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    if (currentMode === MOVE_MODE.GRID) {
        head = { x: snake[0].x + dx, y: snake[0].y + dy };
        // 狂暴模式：墙壁穿越
        if (isRageMode) {
            const tcx = Math.floor(TILE_COUNT_X);
            const tcy = Math.floor(TILE_COUNT_Y);
            head.x = ((head.x % tcx) + tcx) % tcx;
            head.y = ((head.y % tcy) + tcy) % tcy;
        }
    } else {
        // 自由模式：基于角度移动
        head = { 
            x: snake[0].x + Math.cos(angle) * moveSpeed, 
            y: snake[0].y + Math.sin(angle) * moveSpeed,
            angle: angle // 保存头部角度用于绘图
        };

        // 边界反弹逻辑
        let bounced = false;
        if (head.x <= 10 || head.x >= logicalWidth - 10) {
            angle = Math.PI - angle; // 左右反弹
            bounced = true;
        }
        if (head.y <= 10 || head.y >= logicalHeight - 10) {
            angle = -angle; // 上下反弹
            bounced = true;
        }

        if (bounced) {
            if (!isRageMode) {
                triggerShake();
                if (navigator.vibrate) navigator.vibrate(20);
            }
            // 重新计算位置避免卡墙
            head.x = snake[0].x + Math.cos(angle) * moveSpeed;
            head.y = snake[0].y + Math.sin(angle) * moveSpeed;
        }
    }
    
    snake.unshift(head); // 添加新头部

    // 检测吃到任何一个食物
    let eatenIndex = -1;
    for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        if (currentMode === MOVE_MODE.GRID) {
            if (head.x === f.x && head.y === f.y) eatenIndex = i;
        } else {
            // 距离判定
            const dist = Math.sqrt((head.x - f.x)**2 + (head.y - f.y)**2);
            if (dist < 15) eatenIndex = i;
        }
        if (eatenIndex !== -1) break;
    }

    if (eatenIndex !== -1) {
        score += 10;
        scoreElement.textContent = score;
        foods.splice(eatenIndex, 1); // 移除被吃的食物
        
        // 增加速度 (狂暴模式期间跳过)
        if (!isRageMode && currentMode === MOVE_MODE.GRID && score % 50 === 0 && GAME_SPEED > 50) {
            GAME_SPEED -= 5;
            clearInterval(gameLoop);
            gameLoop = setInterval(main, GAME_SPEED);
        }
        
        if (navigator.vibrate) {
            navigator.vibrate(20);
        }

        spawnFood();
    } else {
        snake.pop(); // 没吃到食物就移除尾部
    }
}

function triggerShake() {
    canvas.parentElement.classList.remove('shake');
    void canvas.parentElement.offsetWidth; // 触发回流
    canvas.parentElement.classList.add('shake');
    setTimeout(() => canvas.parentElement.classList.remove('shake'), 200);
}

function moveNPCs() {
    npcs.forEach(npc => {
        if (currentMode === MOVE_MODE.GRID) {
            // 简单的AI逻辑：寻找最近的食物
            let target = null;
            let minDist = Infinity;
            
            foods.forEach(f => {
                const d = Math.abs(f.x - npc.body[0].x) + Math.abs(f.y - npc.body[0].y);
                if (d < minDist) {
                    minDist = d;
                    target = f;
                }
            });
            
            let possibleMoves = [
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
            ];

            possibleMoves = possibleMoves.filter(m => !(m.dx === -npc.dx && m.dy === -npc.dy));
            possibleMoves = possibleMoves.filter(m => {
                const nextX = npc.body[0].x + m.dx;
                const nextY = npc.body[0].y + m.dy;
                return !checkCollision(nextX, nextY);
            });

            let bestMove = possibleMoves[0];
            if (target && possibleMoves.length > 0) {
                let minD = Infinity;
                possibleMoves.forEach(m => {
                    const nextX = npc.body[0].x + m.dx;
                    const nextY = npc.body[0].y + m.dy;
                    const d = Math.abs(nextX - target.x) + Math.abs(nextY - target.y);
                    if (d < minD) {
                        minD = d;
                        bestMove = m;
                    }
                });
            } else if (possibleMoves.length > 0) {
                bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            }

            if (bestMove) {
                npc.dx = bestMove.dx;
                npc.dy = bestMove.dy;
            }

            const head = { x: npc.body[0].x + npc.dx, y: npc.body[0].y + npc.dy };
            npc.body.unshift(head);

            let eatenIndex = -1;
            for (let i = 0; i < foods.length; i++) {
                if (head.x === foods[i].x && head.y === foods[i].y) {
                    eatenIndex = i;
                    break;
                }
            }

            if (eatenIndex !== -1) {
                foods.splice(eatenIndex, 1);
                spawnFood();
            } else {
                npc.body.pop();
            }
        } else {
            // 自由模式 NPC AI
            const dpr = window.devicePixelRatio || 1;
            const logicalWidth = canvas.width / dpr;
            const logicalHeight = canvas.height / dpr;

            if (!npc.angle) npc.angle = Math.random() * Math.PI * 2;
            
            // 寻找最近食物并平滑转向
            let target = null;
            let minDist = Infinity;
            foods.forEach(f => {
                const d = Math.sqrt((f.x - npc.body[0].x)**2 + (f.y - npc.body[0].y)**2);
                if (d < minDist) {
                    minDist = d;
                    target = f;
                }
            });

            if (target) {
                const targetAngle = Math.atan2(target.y - npc.body[0].y, target.x - npc.body[0].x);
                let diff = targetAngle - npc.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                npc.angle += diff * 0.1;
            }

            const head = { 
                x: npc.body[0].x + Math.cos(npc.angle) * moveSpeed * 0.8, 
                y: npc.body[0].y + Math.sin(npc.angle) * moveSpeed * 0.8,
                angle: npc.angle
            };

            // NPC 边界反弹
            if (head.x <= 10 || head.x >= logicalWidth - 10) npc.angle = Math.PI - npc.angle;
            if (head.y <= 10 || head.y >= logicalHeight - 10) npc.angle = -npc.angle;

            npc.body.unshift(head);
            
            let eatenIndex = -1;
            for (let i = 0; i < foods.length; i++) {
                const f = foods[i];
                const dist = Math.sqrt((head.x - f.x)**2 + (head.y - f.y)**2);
                if (dist < 15) {
                    eatenIndex = i;
                    break;
                }
            }

            if (eatenIndex !== -1) {
                foods.splice(eatenIndex, 1);
                spawnFood();
            } else {
                npc.body.pop();
            }
        }
    });
}

function checkCollision(x, y) {
    if (currentMode === MOVE_MODE.GRID) {
        // 撞墙
        if (x < 0 || x >= TILE_COUNT_X || y < 0 || y >= TILE_COUNT_Y) return true;
        
        // 撞玩家
        for (let part of snake) {
            if (x === part.x && y === part.y) return true;
        }
        
        // 撞NPC
        for (let npc of npcs) {
            for (let part of npc.body) {
                if (x === part.x && y === part.y) return true;
            }
        }
    } else {
        // 自由模式：距离判定
        for (let i = 10; i < snake.length; i++) { // 忽略头部附近节
            const d = Math.sqrt((x - snake[i].x)**2 + (y - snake[i].y)**2);
            if (d < 10) return true;
        }
        for (let npc of npcs) {
            for (let part of npc.body) {
                const d = Math.sqrt((x - part.x)**2 + (y - part.y)**2);
                if (d < 10) return true;
            }
        }
    }
    
    return false;
}

function checkNPCCollisions() {
    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];
        const head = npc.body[0];
        
        if (currentMode === MOVE_MODE.GRID) {
            if (head.x < 0 || head.x >= TILE_COUNT_X || head.y < 0 || head.y >= TILE_COUNT_Y) {
                killNPC(i);
                continue;
            }
        }

        let hitOther = false;
        // 撞玩家
        for (let part of snake) {
            const dist = currentMode === MOVE_MODE.GRID ? 
                (head.x === part.x && head.y === part.y) :
                (Math.sqrt((head.x - part.x)**2 + (head.y - part.y)**2) < 12);
            if (dist) { hitOther = true; break; }
        }
        
        if (!hitOther) {
            // 撞其他NPC
            for (let j = 0; j < npcs.length; j++) {
                if (i === j) continue;
                for (let part of npcs[j].body) {
                    const dist = currentMode === MOVE_MODE.GRID ? 
                        (head.x === part.x && head.y === part.y) :
                        (Math.sqrt((head.x - part.x)**2 + (head.y - part.y)**2) < 12);
                    if (dist) { hitOther = true; break; }
                }
                if (hitOther) break;
            }
        }
        
        if (hitOther) killNPC(i);
    }
}

function killNPC(index) {
    const npc = npcs[index];
    // 尸体变食物：在尸体位置生成食物点
    npc.body.forEach((part, idx) => {
        // 隔几个点生成一个食物，避免食物太多太密集
        if (idx % 2 === 0) {
            foods.push({ x: part.x, y: part.y });
        }
    });
    
    npcs.splice(index, 1);
    
    // 震动提示
    if (navigator.vibrate && isMobile) {
        navigator.vibrate(30);
    }
}

function spawnNPC(count = 1) {
    for (let i = 0; i < count; i++) {
        let x, y, safe;
        let attempts = 0;
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = canvas.width / dpr;
        const logicalHeight = canvas.height / dpr;
        
        do {
            if (currentMode === MOVE_MODE.GRID) {
                x = Math.floor(Math.random() * TILE_COUNT_X);
                y = Math.floor(Math.random() * TILE_COUNT_Y);
            } else {
                x = Math.random() * (logicalWidth - 40) + 20;
                y = Math.random() * (logicalHeight - 40) + 20;
            }
            safe = !checkCollision(x, y);
            attempts++;
        } while (!safe && attempts < 50);
        
        if (safe) {
            const body = [];
            const npcAngle = Math.random() * Math.PI * 2;
            if (currentMode === MOVE_MODE.GRID) {
                body.push({x, y}, {x, y: y+1}, {x, y: y+2});
            } else {
                for(let j=0; j<15; j++) body.push({x: x - j*5, y, angle: npcAngle});
            }
            npcs.push({
                body: body,
                dx: 0, dy: -1, 
                angle: npcAngle
            });
        }
    }
}

function spawnFood(x, y) {
    let newFood = {};
    let valid = false;
    let attempts = 0;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    while (!valid && attempts < 100) {
        if (currentMode === MOVE_MODE.GRID) {
            newFood.x = Math.floor(Math.random() * TILE_COUNT_X);
            newFood.y = Math.floor(Math.random() * TILE_COUNT_Y);
        } else {
            newFood.x = Math.random() * (logicalWidth - 40) + 20;
            newFood.y = Math.random() * (logicalHeight - 40) + 20;
        }
        
        if (!checkCollision(newFood.x, newFood.y)) {
            let overlap = false;
            for(let f of foods) {
                const dist = currentMode === MOVE_MODE.GRID ? 
                    (f.x === newFood.x && f.y === newFood.y) :
                    (Math.sqrt((f.x - newFood.x)**2 + (f.y - newFood.y)**2) < 20);
                if (dist) { overlap = true; break; }
            }
            if (!overlap) valid = true;
        }
        attempts++;
    }
    if (valid) foods.push(newFood);
}

function drawFoods() {
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.food;
    ctx.fillStyle = COLORS.food;
    
    foods.forEach(f => {
        let centerX, centerY;
        if (currentMode === MOVE_MODE.GRID) {
            centerX = f.x * GRID_SIZE + GRID_SIZE / 2;
            centerY = f.y * GRID_SIZE + GRID_SIZE / 2;
        } else {
            centerX = f.x;
            centerY = f.y;
        }
        const radius = GRID_SIZE / 2 - 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.shadowBlur = 0;
}

function checkGameOver() {
    // 狂暴模式期间无敌
    if (isRageMode) return;

    const head = snake[0];
    
    if (currentMode === MOVE_MODE.GRID) {
        // 撞墙
        if (head.x < 0 || head.x >= TILE_COUNT_X || head.y < 0 || head.y >= TILE_COUNT_Y) {
            isGameOver = true;
        }
        // 撞自己
        for (let i = 4; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) isGameOver = true;
        }
    } else {
        // 自由模式：不检测撞自己，允许自由穿梭
    }
    
    if (!isGameOver) {
        // 通用：撞NPC身体
        for (let npc of npcs) {
            for (let part of npc.body) {
                const distThreshold = currentMode === MOVE_MODE.GRID ? 0.1 : 11; // 统一自由模式下的碰撞阈值
                if (currentMode === MOVE_MODE.GRID) {
                    if (head.x === part.x && head.y === part.y) { isGameOver = true; break; }
                } else {
                    const d = Math.sqrt((head.x - part.x)**2 + (head.y - part.y)**2);
                    if (d < distThreshold) { isGameOver = true; break; }
                }
            }
            if (isGameOver) break;
        }
    }

    if (isGameOver) vibrateDeath();
}

function vibrateDeath() {
    if (navigator.vibrate && isMobile) {
        navigator.vibrate([100, 50, 100]);
    }
}

function handleGameOver() {
    clearInterval(gameLoop);
    if (npcSpawnInterval) clearInterval(npcSpawnInterval);
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        if (highScoreElement) highScoreElement.textContent = highScore;
    }
}

function handleDirectionChange(newDx, newDy) {
    if (!hasStarted || isPaused) return;
    
    if (currentMode === MOVE_MODE.FREE) {
        // 自由模式：键盘左右键控制角度转向
        if (newDx === -1) angle -= 0.2;
        if (newDx === 1) angle += 0.2;
        return;
    }

    // 如果是摇杆模式，允许快速响应，不严格限制 changingDirection
    // 因为摇杆是连续的
    if (controlMode === 'dpad' && changingDirection) return;

    const goingUp = dy === -1;
    const goingDown = dy === 1;
    const goingRight = dx === 1;
    const goingLeft = dx === -1;

    // 防止反向掉头
    if (newDx === -1 && goingRight) return;
    if (newDx === 1 && goingLeft) return;
    if (newDy === -1 && goingDown) return;
    if (newDy === 1 && goingUp) return;
    
    if (dx !== newDx || dy !== newDy) {
        dx = newDx;
        dy = newDy;
        changingDirection = true;
    }
}

function handleKeyPress(event) {
    const key = event.key;
    
    // 暂停
    if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        togglePause();
        return;
    }
    
    if (!hasStarted || isPaused) return;
    
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault();
    }

    if (key === 'ArrowLeft') handleDirectionChange(-1, 0);
    else if (key === 'ArrowUp') handleDirectionChange(0, -1);
    else if (key === 'ArrowRight') handleDirectionChange(1, 0);
    else if (key === 'ArrowDown') handleDirectionChange(0, 1);
}

function togglePause() {
    if (hasStarted && !isGameOver) {
        isPaused = !isPaused;
        if (isPaused) {
            pauseScreen.classList.remove('hidden');
        } else {
            pauseScreen.classList.add('hidden');
            if (gameLoop) clearInterval(gameLoop);
            gameLoop = setInterval(main, GAME_SPEED);
        }
    }
}

function setupMobileControls() {
    // 无论是否移动端，都绑定事件（防备开发工具切换模拟器）
    // 避免重复绑定
    if (!toggleModeBtn.hasAttribute('data-bound')) {
        toggleModeBtn.setAttribute('data-bound', 'true');
        
        toggleModeBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (!config.allowModeSwitch) return; // 二次校验
            
            if (currentMode === MOVE_MODE.GRID) {
                // 切换到 自由模式
                currentMode = MOVE_MODE.FREE;
                controlMode = 'joystick';
                
                // 强制隐藏十字键，显示摇杆
                dpadContainer.classList.add('hidden');
                joystickContainer.classList.remove('hidden');
                
                toggleModeBtn.innerHTML = '<span class="icon">🎡</span> 自由模式';
                toggleModeBtn.classList.remove('grid-mode');
                toggleModeBtn.classList.add('free-mode');
                setupJoystick();
            } else {
                // 切换到 网格模式
                currentMode = MOVE_MODE.GRID;
                controlMode = 'dpad';
                
                // 强制隐藏摇杆，显示十字键
                joystickContainer.classList.add('hidden');
                dpadContainer.classList.remove('hidden');
                
                toggleModeBtn.innerHTML = '<span class="icon">🕹️</span> 网格模式';
                toggleModeBtn.classList.remove('free-mode');
                toggleModeBtn.classList.add('grid-mode');
            }
            
            // 切换即重置
            resetGame();
        });

        // 初始化按钮状态
        if (currentMode === MOVE_MODE.GRID) {
            toggleModeBtn.classList.add('grid-mode');
        } else {
            toggleModeBtn.classList.add('free-mode');
        }

        // 绑定触摸控件 (只绑定一次)
        bindTouchControl(btnUp, 0, -1);
        bindTouchControl(btnDown, 0, 1);
        bindTouchControl(btnLeft, -1, 0);
        bindTouchControl(btnRight, 1, 0);
    }

    // 初始状态设置 & 响应式更新
    updateMobileControlVisibility();
}

function updateMobileControlVisibility() {
    // 始终显示模式切换按钮区域
    mobileControlArea.classList.remove('hidden');
    const topControls = toggleModeBtn.closest('.top-controls');
    if (topControls) topControls.classList.remove('hidden');
    
    // 根据当前模式显示对应的控件
    if (controlMode === 'dpad') {
        dpadContainer.classList.remove('hidden');
        joystickContainer.classList.add('hidden');
    } else {
        dpadContainer.classList.add('hidden');
        joystickContainer.classList.remove('hidden');
    }
}

function setupJoystick() {
    // 避免重复绑定
    if (joystickZone.hasAttribute('data-bound')) return;
    joystickZone.setAttribute('data-bound', 'true');

    const handleStart = (e) => {
        e.preventDefault();
        if (isGameOver || isPaused) return;
        
        const touch = e.type === 'touchstart' ? e.changedTouches[0] : e;
        joystickTouchId = touch.identifier;
        joystickActive = true;
        
        // 记录中心点（相对于视口）
        const rect = joystickZone.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        updateJoystick(touch);
    };

    const handleMove = (e) => {
        if (!joystickActive) return;
        e.preventDefault();
        
        let touch = null;
        if (e.type === 'touchmove') {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    touch = e.changedTouches[i];
                    break;
                }
            }
        } else {
            touch = e;
        }
        
        if (touch) updateJoystick(touch);
    };

    const handleEnd = (e) => {
        if (joystickActive) {
            e.preventDefault();
            joystickActive = false;
            joystickKnob.style.transform = `translate(-50%, -50%)`; // 回弹
        }
    };

    joystickZone.addEventListener('touchstart', handleStart, {passive: false});
    window.addEventListener('touchmove', handleMove, {passive: false}); // 绑定到window防滑出
    window.addEventListener('touchend', handleEnd);
    
    // 鼠标支持（测试用）
    joystickZone.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
}

function updateJoystick(touch) {
    const maxRadius = 35; 
    const dxRaw = touch.clientX - joystickCenter.x;
    const dyRaw = touch.clientY - joystickCenter.y;
    
    const distance = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
    const newAngle = Math.atan2(dyRaw, dxRaw);
    
    const cappedDist = Math.min(distance, maxRadius);
    const knobX = Math.cos(newAngle) * cappedDist;
    const knobY = Math.sin(newAngle) * cappedDist;
    
    joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    
    if (distance > 10) {
        if (currentMode === MOVE_MODE.GRID) {
            // 网格模式：转换为 4 方向
            if (newAngle > -Math.PI/4 && newAngle <= Math.PI/4) handleDirectionChange(1, 0); 
            else if (newAngle > Math.PI/4 && newAngle <= 3*Math.PI/4) handleDirectionChange(0, 1); 
            else if (newAngle > -3*Math.PI/4 && newAngle <= -Math.PI/4) handleDirectionChange(0, -1); 
            else handleDirectionChange(-1, 0); 
        } else {
            // 自由模式：直接更新角度
            angle = newAngle;
        }
    }
}

function bindTouchControl(element, newDx, newDy) {
    if (!element) return;

    const handleInput = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        element.classList.add('active');
        if (navigator.vibrate) navigator.vibrate(50);
        handleDirectionChange(newDx, newDy);
    };
    
    const handleRelease = (e) => {
        if (e.type === 'touchend') e.preventDefault();
        element.classList.remove('active');
    };

    element.addEventListener('touchstart', handleInput, { passive: false });
    element.addEventListener('touchend', handleRelease, { passive: false });
    element.addEventListener('mousedown', handleInput);
    element.addEventListener('mouseup', handleRelease);
    element.addEventListener('mouseleave', handleRelease);
}

// ============ 狂暴模式 ============

// 三击检测
canvas.addEventListener('click', handleRageTap);
canvas.addEventListener('touchstart', (e) => {
    lastTapTime = Date.now();
    handleRageTap(e);
}, { passive: true });

function handleRageTap(e) {
    // touch+click 50ms去重
    const now = Date.now();
    if (e.type === 'click' && (now - lastTapTime) < 50) return;

    if (!hasStarted || isGameOver || isPaused || isRageMode) return;

    tapTimestamps.push(now);
    // 只保留窗口内的时间戳
    tapTimestamps = tapTimestamps.filter(t => now - t < TRIPLE_TAP_WINDOW);

    if (tapTimestamps.length >= TRIPLE_TAP_COUNT) {
        tapTimestamps = [];
        activateRageMode();
    }
}

function activateRageMode() {
    isRageMode = true;
    rageStartTime = Date.now();
    ragePhase = 'eat';
    isVictoryShown = false;

    // 保存当前速度
    savedGameSpeed = GAME_SPEED;
    savedMoveSpeed = moveSpeed;

    // 杀死所有NPC
    for (let i = npcs.length - 1; i >= 0; i--) {
        killNPC(i);
    }
    // 停止NPC刷新
    if (npcSpawnInterval) { clearInterval(npcSpawnInterval); npcSpawnInterval = null; }

    // 额外撒食物
    const extraFood = currentMode === MOVE_MODE.GRID ? 15 : 25;
    for (let i = 0; i < extraFood; i++) spawnFood();

    // 加速
    if (currentMode === MOVE_MODE.GRID) {
        GAME_SPEED = RAGE_GRID_SPEED;
        // 生成zigzag路径
        rageFillPath = generateZigzagPath();
        rageFillIndex = 0;
    } else {
        moveSpeed = RAGE_FREE_SPEED;
        GAME_SPEED = 20;
        rageSweepDir = 1;
        rageSweepY = 20;
    }

    clearInterval(gameLoop);
    gameLoop = setInterval(main, GAME_SPEED);

    // 视觉效果
    canvas.parentElement.classList.add('rage-mode');
    if (rageIndicator) rageIndicator.classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);

    // 15秒倒计时结束 → 直接胜利
    rageTimer = setTimeout(() => {
        if (!isRageMode || isVictoryShown) return;
        triggerUltimateVictory();
    }, RAGE_DURATION);
}

function deactivateRageMode() {
    isRageMode = false;
    ragePhase = 'eat';
    if (rageTimer) { clearTimeout(rageTimer); rageTimer = null; }

    // 恢复速度
    GAME_SPEED = savedGameSpeed || 180;
    moveSpeed = savedMoveSpeed || 5;
    clearInterval(gameLoop);
    gameLoop = setInterval(main, GAME_SPEED);

    // 重启NPC
    if (config.enableNPC) {
        spawnNPC(2);
        npcSpawnInterval = setInterval(() => {
            if (!isGameOver && !isPaused && npcs.length < 5) spawnNPC(2);
        }, 15000);
    }

    // 移除视觉效果
    canvas.parentElement.classList.remove('rage-mode');
    if (rageIndicator) rageIndicator.classList.add('hidden');
}

// ---- 网格模式AI ----

function generateZigzagPath() {
    const path = [];
    const cols = Math.floor(TILE_COUNT_X);
    const rows = Math.floor(TILE_COUNT_Y);
    for (let y = 0; y < rows; y++) {
        if (y % 2 === 0) {
            for (let x = 0; x < cols; x++) path.push({ x, y });
        } else {
            for (let x = cols - 1; x >= 0; x--) path.push({ x, y });
        }
    }
    return path;
}

function getRageDirectionGrid() {
    const head = snake[0];
    const totalCells = Math.floor(TILE_COUNT_X) * Math.floor(TILE_COUNT_Y);

    // 切换阶段：蛇长>40%格子时进入铺满阶段
    if (ragePhase === 'eat' && snake.length > totalCells * 0.4) {
        ragePhase = 'fill';
        rageFillPath = generateZigzagPath();
        // 找到最近的路径点开始
        let minDist = Infinity;
        for (let i = 0; i < rageFillPath.length; i++) {
            const d = Math.abs(rageFillPath[i].x - head.x) + Math.abs(rageFillPath[i].y - head.y);
            if (d < minDist) { minDist = d; rageFillIndex = i; }
        }
    }

    if (ragePhase === 'eat') {
        return chaseNearestFoodGrid(head);
    } else {
        return followFillPath(head);
    }
}

function chaseNearestFoodGrid(head) {
    let target = null;
    let minDist = Infinity;
    foods.forEach(f => {
        const d = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
        if (d < minDist) { minDist = d; target = f; }
    });

    if (!target) return { dx: dx || 1, dy: dy || 0 };
    return chaseTargetGrid(head, target);
}

function chaseTargetGrid(head, target) {
    const possibleMoves = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    // 防掉头
    const filtered = possibleMoves.filter(m => !(m.dx === -dx && m.dy === -dy));

    // 安全检查（不撞自己头部附近）
    const safe = filtered.filter(m => {
        const nx = head.x + m.dx;
        const ny = head.y + m.dy;
        // 穿越后的坐标
        const tcx = Math.floor(TILE_COUNT_X);
        const tcy = Math.floor(TILE_COUNT_Y);
        const wx = ((nx % tcx) + tcx) % tcx;
        const wy = ((ny % tcy) + tcy) % tcy;
        // 不撞蛇身（忽略最后几节，因为会移走）
        for (let i = 0; i < snake.length - 2; i++) {
            if (snake[i].x === wx && snake[i].y === wy) return false;
        }
        return true;
    });

    const candidates = safe.length > 0 ? safe : filtered;
    if (candidates.length === 0) return { dx: dx || 1, dy: dy || 0 };

    // 选距目标最近的
    let best = candidates[0];
    let bestDist = Infinity;
    candidates.forEach(m => {
        const tcx = Math.floor(TILE_COUNT_X);
        const tcy = Math.floor(TILE_COUNT_Y);
        const nx = ((head.x + m.dx) % tcx + tcx) % tcx;
        const ny = ((head.y + m.dy) % tcy + tcy) % tcy;
        const d = Math.abs(nx - target.x) + Math.abs(ny - target.y);
        if (d < bestDist) { bestDist = d; best = m; }
    });

    return best;
}

function followFillPath(head) {
    // 找路径中下一个未被蛇占据的点
    const snakeSet = new Set(snake.map(s => `${Math.floor(s.x)},${Math.floor(s.y)}`));
    let target = null;
    let searchCount = 0;
    const pathLen = rageFillPath.length;

    while (searchCount < pathLen) {
        const idx = (rageFillIndex + searchCount) % pathLen;
        const p = rageFillPath[idx];
        if (!snakeSet.has(`${p.x},${p.y}`)) {
            target = p;
            rageFillIndex = idx;
            break;
        }
        searchCount++;
    }

    // 如果沿路径有食物优先吃
    if (foods.length > 0) {
        let nearestFood = null;
        let nearestDist = Infinity;
        foods.forEach(f => {
            const d = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
            if (d < nearestDist) { nearestDist = d; nearestFood = f; }
        });
        if (nearestFood && nearestDist < 8) target = nearestFood;
    }

    if (!target) target = rageFillPath[rageFillIndex % pathLen];
    return chaseTargetGrid(head, target);
}

// ---- 自由模式AI ----

function getRageDirectionFree() {
    const head = snake[0];
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const margin = 15;
    const boundaryZone = 40; // 提前转向区域

    // 估算覆盖比
    const gridSize = 20;
    const totalVCells = Math.floor(logicalWidth / gridSize) * Math.floor(logicalHeight / gridSize);
    const coveredSet = new Set();
    snake.forEach(s => {
        coveredSet.add(`${Math.floor(s.x / gridSize)},${Math.floor(s.y / gridSize)}`);
    });
    const coverRatio = coveredSet.size / totalVCells;

    if (ragePhase === 'eat' && coverRatio > 0.35) {
        ragePhase = 'fill';
    }

    let targetAngle;

    if (ragePhase === 'eat') {
        // 追踪最近食物
        let target = null;
        let minDist = Infinity;
        foods.forEach(f => {
            const d = Math.sqrt((f.x - head.x) ** 2 + (f.y - head.y) ** 2);
            if (d < minDist) { minDist = d; target = f; }
        });

        if (target) {
            targetAngle = Math.atan2(target.y - head.y, target.x - head.x);
        } else {
            targetAngle = angle;
        }
    } else {
        // 蛇形扫描：左右往返 + 逐行下移
        let targetX = rageSweepDir > 0 ? (logicalWidth - margin) : margin;
        let targetY = rageSweepY;

        const distToEdge = Math.abs(head.x - targetX);
        if (distToEdge < 25) {
            rageSweepDir *= -1;
            rageSweepY += 22;
            if (rageSweepY > logicalHeight - margin) {
                rageSweepY = margin;
            }
            targetX = rageSweepDir > 0 ? (logicalWidth - margin) : margin;
            targetY = rageSweepY;
        }

        targetAngle = Math.atan2(targetY - head.y, targetX - head.x);
    }

    // 边界主动避让：接近边界时强制转向内侧，不依赖反弹
    let avoidAngle = null;
    if (head.x < boundaryZone) {
        avoidAngle = 0; // 向右
    } else if (head.x > logicalWidth - boundaryZone) {
        avoidAngle = Math.PI; // 向左
    }
    if (head.y < boundaryZone) {
        avoidAngle = avoidAngle != null ? (avoidAngle + Math.PI / 2) / 2 : Math.PI / 2; // 向下
    } else if (head.y > logicalHeight - boundaryZone) {
        avoidAngle = avoidAngle != null ? (avoidAngle - Math.PI / 2) / 2 : -Math.PI / 2; // 向上
    }

    if (avoidAngle != null) {
        // 在边界区域，混合避让角度和目标角度，边界越近避让权重越大
        const edgeDist = Math.min(head.x, head.y, logicalWidth - head.x, logicalHeight - head.y);
        const urgency = 1 - Math.max(0, Math.min(1, edgeDist / boundaryZone));
        // 插值：urgency=1时完全避让，urgency=0时完全追目标
        let diff1 = avoidAngle - angle;
        while (diff1 < -Math.PI) diff1 += Math.PI * 2;
        while (diff1 > Math.PI) diff1 -= Math.PI * 2;
        let diff2 = targetAngle - angle;
        while (diff2 < -Math.PI) diff2 += Math.PI * 2;
        while (diff2 > Math.PI) diff2 -= Math.PI * 2;
        const blendedDiff = diff1 * urgency + diff2 * (1 - urgency);
        return angle + blendedDiff * 0.8;
    }

    // 正常转向：直接用大系数快速对准目标
    let diff = targetAngle - angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return angle + diff * 0.8;
}

// ---- 覆盖率计算 ----

function calculateCoverage() {
    if (currentMode === MOVE_MODE.GRID) {
        const occupied = new Set();
        snake.forEach(s => occupied.add(`${Math.floor(s.x)},${Math.floor(s.y)}`));
        const totalCells = Math.floor(TILE_COUNT_X) * Math.floor(TILE_COUNT_Y);
        return occupied.size / totalCells;
    } else {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = canvas.width / dpr;
        const logicalHeight = canvas.height / dpr;
        const vGridSize = 20;
        const cols = Math.floor(logicalWidth / vGridSize);
        const rows = Math.floor(logicalHeight / vGridSize);
        const totalCells = cols * rows;
        const occupied = new Set();
        snake.forEach(s => {
            const cx = Math.floor(s.x / vGridSize);
            const cy = Math.floor(s.y / vGridSize);
            occupied.add(`${cx},${cy}`);
        });
        return occupied.size / totalCells;
    }
}

// ---- 指示器更新 ----

function updateRageIndicator(coverage) {
    if (!rageTimerEl || !rageCoverageEl) return;
    const elapsed = Date.now() - rageStartTime;
    const remaining = Math.max(0, Math.ceil((RAGE_DURATION - elapsed) / 1000));
    rageTimerEl.textContent = remaining + 's';
    rageCoverageEl.textContent = Math.floor(coverage * 100) + '%';
}

// ---- 红色渐晕 ----

function drawRageVignette() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const pulse = 0.15 + Math.sin(Date.now() / 200) * 0.08;

    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(255, 0, 0, ${pulse})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

// ---- 胜利 & 撒花 ----

function triggerUltimateVictory() {
    isVictoryShown = true;
    if (rageTimer) { clearTimeout(rageTimer); rageTimer = null; }

    // 停止游戏循环
    clearInterval(gameLoop);

    // 显示胜利页面
    if (victoryScoreValue) victoryScoreValue.textContent = score;
    if (victoryScreen) victoryScreen.classList.remove('hidden');

    // 更新最高分
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        if (highScoreElement) highScoreElement.textContent = highScore;
    }

    startConfetti();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
}

function startConfetti() {
    if (!confettiCanvas || !confettiCtx) return;

    // 显示并调整为全屏尺寸
    confettiCanvas.classList.remove('hidden');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ccff', '#0044ff', '#aa00ff', '#ff00cc', '#ffd700'];

    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight * -1, // 从上方开始
            w: Math.random() * 8 + 4,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            alpha: 1,
        });
    }

    function animateConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        let alive = false;
        confettiParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // 重力
            p.rotation += p.rotSpeed;

            // 超出底部后淡出
            if (p.y > confettiCanvas.height) {
                p.alpha -= 0.02;
            }

            if (p.alpha <= 0) return;
            alive = true;

            confettiCtx.save();
            confettiCtx.globalAlpha = p.alpha;
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            confettiCtx.restore();
        });

        if (alive) {
            confettiAnimFrame = requestAnimationFrame(animateConfetti);
        }
    }

    confettiAnimFrame = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
    if (confettiAnimFrame) {
        cancelAnimationFrame(confettiAnimFrame);
        confettiAnimFrame = null;
    }
    confettiParticles = [];
    if (confettiCtx && confettiCanvas) {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiCanvas.classList.add('hidden');
    }
}

function resetFromVictory() {
    if (victoryScreen) victoryScreen.classList.add('hidden');
    stopConfetti();
    deactivateRageMode();
    initGame();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(main, GAME_SPEED);
}

// 初始不启动游戏，只绘制空网格
clearCanvas();
drawGrid();
