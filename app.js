/**
 * FootyQuiz Pro - Next-Gen 3D Broadcast Matchday Engine
 * Supports:
 * 1. Who Wants to Be a Football Millionaire ($1M Ladder, Very Easy ➔ Elite, Safety Nets)
 * 2. Custom Match (Pick your Difficulty & League)
 * 3. Sudden Death Penalty Shootout
 * Complete with Three.js 3D Stadium Shootout, Audio Synthesizer, Fan Poll, and 3D FUT Card Reveal.
 */

class Footy3DBroadcastApp {
  constructor() {
    // Mode: 'millionaire', 'custom', 'survival'
    this.currentMode = 'millionaire';
    this.customDifficulty = 'Very Easy';
    this.customCompetition = 'all';

    // Millionaire Ladder Rungs
    this.millionairePrizes = [
      100, 200, 300, 500, 1000, 
      2000, 4000, 8000, 16000, 32000, 
      64000, 125000, 250000, 500000, 1000000
    ];
    this.millionaireTiers = [
      "Very Easy", "Very Easy", "Very Easy", "Easy", "Easy",
      "Easy", "Medium", "Medium", "Hard", "Hard",
      "Hard", "Very Hard", "Very Hard", "Elite", "Elite"
    ];

    // Game Data
    this.allQuestions = [];
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.currentBank = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // State
    this.isAnsweringAllowed = false;
    this.selectedOption = null;
    this.isGameOver = false;

    // Lifelines (1 per game)
    this.lifelines = {
      fifty: true,
      fans: true,
      freeze: true
    };

    // 30s Timer
    this.timerSeconds = 30;
    this.timerInterval = null;

    // Sound
    this.soundEnabled = true;
    this.audioCtx = null;

    // Three.js Stadium & Ball
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ball = null;
    this.netMesh = null;
    this.floodlights = [];
    this.ballInitialPos = { x: 0, y: 0.45, z: 2.2 };
    this.isShooting = false;

    this.init();
  }

  async init() {
    this.initThreeStadium();
    this.initCardTiltEffects();
    this.initKeyboardShortcuts();
    lucide.createIcons();

    await this.loadQuestions();
    this.startMatch();
  }

  // =========================================================
  // 1. THREE.JS 3D STADIUM, GOAL FRAME & BALL SHOOTOUT
  // =========================================================
  initThreeStadium() {
    const canvas = document.getElementById('three-stadium-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050811, 0.035);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.6, 5.2);
    this.camera.lookAt(0, 1.2, -3);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Pitch
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x071e12, roughness: 0.85, metalness: 0.1 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // White Touchline
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const penaltyLine = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.08), lineMat);
    penaltyLine.rotation.x = -Math.PI / 2;
    penaltyLine.position.set(0, 0.01, 1.5);
    this.scene.add(penaltyLine);

    // Goal Frame
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 16), postMat);
    leftPost.position.set(-2.8, 1.3, -4);
    this.scene.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 16), postMat);
    rightPost.position.set(2.8, 1.3, -4);
    this.scene.add(rightPost);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.68, 16), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 2.6, -4);
    this.scene.add(crossbar);

    // Net
    const netGeo = new THREE.PlaneGeometry(5.6, 2.6, 14, 8);
    const netMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true, transparent: true, opacity: 0.4 });
    this.netMesh = new THREE.Mesh(netGeo, netMat);
    this.netMesh.position.set(0, 1.3, -4.5);
    this.scene.add(this.netMesh);

    // Soccer Ball
    const ballCanvas = document.createElement('canvas');
    ballCanvas.width = 512;
    ballCanvas.height = 512;
    const bctx = ballCanvas.getContext('2d');
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#0f172a';
    
    const drawPentagon = (x, y, r) => {
      bctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i === 0) bctx.moveTo(px, py);
        else bctx.lineTo(px, py);
      }
      bctx.closePath();
      bctx.fill();
    };
    drawPentagon(256, 256, 75);
    drawPentagon(80, 110, 55);
    drawPentagon(432, 110, 55);
    drawPentagon(120, 410, 55);
    drawPentagon(392, 410, 55);

    const ballTexture = new THREE.CanvasTexture(ballCanvas);
    const ballMat = new THREE.MeshStandardMaterial({ map: ballTexture, roughness: 0.25, metalness: 0.15 });

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), ballMat);
    this.ball.position.set(this.ballInitialPos.x, this.ballInitialPos.y, this.ballInitialPos.z);
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    // Floodlights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const light1 = new THREE.SpotLight(0x00f59b, 2.5, 40, Math.PI / 4, 0.4);
    light1.position.set(-8, 12, 6);
    light1.target = this.ball;
    this.scene.add(light1);
    this.floodlights.push(light1);

    const light2 = new THREE.SpotLight(0x38bdf8, 2.0, 40, Math.PI / 4, 0.4);
    light2.position.set(8, 12, 6);
    light2.target = this.ball;
    this.scene.add(light2);
    this.floodlights.push(light2);

    // Atmosphere Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 20;
      particlePositions[i + 1] = Math.random() * 8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x00f59b, size: 0.045, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(particles);

    // Resize Handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animation Loop
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;
      if (!this.isShooting && this.ball) {
        this.ball.rotation.y += 0.005;
        this.ball.rotation.x += 0.003;
      }
      particles.rotation.y = time * 0.03;
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  shootBall(isCorrect) {
    if (!this.ball || this.isShooting) return;
    this.isShooting = true;

    const startX = this.ball.position.x;
    const startY = this.ball.position.y;
    const startZ = this.ball.position.z;

    let targetX = 2.0;
    let targetY = 2.2;
    let targetZ = -4.2;

    if (!isCorrect) {
      targetX = 0.2;
      targetY = 2.65;
      targetZ = -4.0;
    }

    let progress = 0;
    const duration = 40;

    this.playBallKickSound();

    const interval = setInterval(() => {
      progress++;
      const t = progress / duration;

      this.ball.position.x = startX + (targetX - startX) * t;
      this.ball.position.z = startZ + (targetZ - startZ) * t;
      this.ball.position.y = startY + (targetY - startY) * t + Math.sin(t * Math.PI) * 1.2;

      this.ball.rotation.x -= 0.35;
      this.ball.rotation.z += 0.15;

      if (progress >= duration) {
        clearInterval(interval);

        if (isCorrect) {
          this.playNetSwooshSound();
          this.playGoalCheer();
          this.flashFloodlights(0x00f59b);
          if (this.netMesh) {
            this.netMesh.position.z = -4.7;
            setTimeout(() => this.netMesh.position.z = -4.5, 300);
          }
          if (window.confetti) {
            confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
          }
        } else {
          this.playCrossbarClangSound();
          this.playRefereeWhistle();
          this.flashFloodlights(0xef4444);
          this.ball.position.z += 0.8;
          this.ball.position.y -= 0.5;
        }

        setTimeout(() => this.resetBallPosition(), 1800);
      }
    }, 16);
  }

  resetBallPosition() {
    if (!this.ball) return;
    this.ball.position.set(this.ballInitialPos.x, this.ballInitialPos.y, this.ballInitialPos.z);
    this.isShooting = false;
  }

  flashFloodlights(colorHex) {
    this.floodlights.forEach(l => {
      l.color.setHex(colorHex);
      l.intensity = 4.5;
      setTimeout(() => {
        l.color.setHex(0x00f59b);
        l.intensity = 2.2;
      }, 600);
    });
  }

  // =========================================================
  // 2. AUDIO SYNTHESIZER
  // =========================================================
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBallKickSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.setValueAtTime(140, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.14);
  }

  playCrossbarClangSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2 / (idx + 1), this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.45);
    });
  }

  playNetSwooshSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    const bufferSize = this.audioCtx.sampleRate * 0.18;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start();
  }

  playGoalCheer() {
    if (!this.soundEnabled) return;
    this.initAudio();
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      setTimeout(() => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);
      }, i * 60);
    });
  }

  playRefereeWhistle() {
    if (!this.soundEnabled) return;
    this.initAudio();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2800, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.28);
  }

  playHeartbeat() {
    if (!this.soundEnabled) return;
    this.initAudio();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.setValueAtTime(80, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.08);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const icon = document.getElementById('icon-sound');
    if (this.soundEnabled) {
      icon.setAttribute('data-lucide', 'volume-2');
      icon.style.color = '#00f59b';
    } else {
      icon.setAttribute('data-lucide', 'volume-x');
      icon.style.color = '#64748b';
    }
    lucide.createIcons();
  }

  initCardTiltEffects() {
    const futCard = document.getElementById('fut-card');
    if (futCard) {
      window.addEventListener('mousemove', (e) => {
        const rect = futCard.getBoundingClientRect();
        const cardX = rect.left + rect.width / 2;
        const cardY = rect.top + rect.height / 2;
        const normX = (e.clientX - cardX) / (window.innerWidth / 2);
        const normY = (e.clientY - cardY) / (window.innerHeight / 2);
        futCard.style.transform = `perspective(800px) rotateY(${normX * 18}deg) rotateX(${-normY * 18}deg)`;
      });
    }
  }

  // =========================================================
  // 3. LOAD QUESTIONS FROM JSON
  // =========================================================
  async loadQuestions() {
    try {
      const res = await fetch('questions.json');
      if (!res.ok) throw new Error("Could not load questions.json");
      this.allQuestions = await res.json();
      console.log(`Loaded ${this.allQuestions.length} football questions!`);
    } catch (e) {
      console.warn("Using fallback questions pool", e);
      this.allQuestions = [
        { id: 1, c: "FIFA World Cup", d: "Very Easy", q: "Which country won the 2022 FIFA World Cup in Qatar?", o: ["Argentina", "France", "Croatia", "Morocco"], a: "Argentina", e: "Argentina defeated France in Qatar 2022." },
        { id: 2, c: "La Liga", d: "Very Easy", q: "Which club does Lionel Messi hold the all-time scoring record for?", o: ["FC Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"], a: "FC Barcelona", e: "Messi scored 672 goals for Barcelona." },
        { id: 3, c: "Premier League", d: "Very Easy", q: "Which club is known as 'The Gunners'?", o: ["Arsenal", "Chelsea", "Liverpool", "Manchester United"], a: "Arsenal", e: "Arsenal was founded in Woolwich 1886." },
        { id: 4, c: "Premier League", d: "Very Easy", q: "What color home shirts do Manchester United and Liverpool wear?", o: ["Red", "Blue", "White", "Yellow"], a: "Red", e: "Both United and Liverpool wear red." },
        { id: 5, c: "FIFA World Cup", d: "Very Easy", q: "How many World Cup trophies has Brazil won?", o: ["5", "3", "4", "6"], a: "5", e: "Brazil holds 5 World Cup titles." }
      ];
    }
  }

  // =========================================================
  // 4. MATCH KICKOFF & MODE LOGIC
  // =========================================================
  startMatch() {
    this.currentIndex = 0;
    this.score = 0;
    this.currentBank = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.isGameOver = false;

    // Reset Lifelines
    this.lifelines = { fifty: true, fans: true, freeze: true };
    document.getElementById('btn-ll-5050').disabled = false;
    document.getElementById('btn-ll-fans').disabled = false;
    document.getElementById('btn-ll-freeze').disabled = false;

    // Update Mode Label & Visibility
    const modeLabel = document.getElementById('active-mode-label');
    const walkAwayBtn = document.getElementById('btn-walk-away');
    const moneySidebar = document.getElementById('money-tree-sidebar');
    const scoreUnit = document.getElementById('hud-score-unit');
    const footerSummary = document.getElementById('footer-summary-label');

    if (this.currentMode === 'millionaire') {
      modeLabel.textContent = "💰 Millionaire Ladder";
      walkAwayBtn.style.display = "inline-flex";
      moneySidebar.style.display = "flex";
      scoreUnit.textContent = "BANK";
      footerSummary.textContent = "Format: Football Millionaire • Ladder from Very Easy to Elite ($1,000,000)";
      this.buildMillionaireQuestions();

    } else if (this.currentMode === 'custom') {
      modeLabel.textContent = `🎯 Tier: ${this.customDifficulty}`;
      walkAwayBtn.style.display = "none";
      moneySidebar.style.display = "none";
      scoreUnit.textContent = "PTS";
      footerSummary.textContent = `Format: Custom Match • ${this.customDifficulty} • ${this.customCompetition}`;
      this.buildCustomQuestions();

    } else {
      // Survival
      modeLabel.textContent = "⚡ Sudden Death";
      walkAwayBtn.style.display = "none";
      moneySidebar.style.display = "none";
      scoreUnit.textContent = "STREAK";
      footerSummary.textContent = "Format: Sudden Death • 1 Miss = Game Over!";
      this.buildSurvivalQuestions();
    }

    this.renderQuestion();
  }

  // Build 15 Progressive Questions: Very Easy -> Elite
  buildMillionaireQuestions() {
    const selected = [];
    for (let i = 0; i < 15; i++) {
      const tier = this.millionaireTiers[i];
      let tierPool = this.allQuestions.filter(q => q.d === tier);
      if (tierPool.length === 0) tierPool = this.allQuestions;
      const q = tierPool[Math.floor(Math.random() * tierPool.length)];
      selected.push(q);
    }
    this.questions = selected;
  }

  // Build 10 Questions matching custom tier & league
  buildCustomQuestions() {
    let pool = this.allQuestions;
    if (this.customCompetition !== 'all') {
      pool = pool.filter(q => q.c === this.customCompetition);
    }
    if (this.customDifficulty !== 'all') {
      const diffPool = pool.filter(q => q.d === this.customDifficulty);
      if (diffPool.length >= 10) pool = diffPool;
    }
    this.questions = [...pool].sort(() => 0.5 - Math.random()).slice(0, 10);
  }

  // Build 25 progressive questions for Sudden Death
  buildSurvivalQuestions() {
    this.questions = [...this.allQuestions].sort(() => 0.5 - Math.random()).slice(0, 25);
  }

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q || this.isGameOver) {
      this.finishMatch();
      return;
    }

    this.isAnsweringAllowed = true;
    this.selectedOption = null;

    document.getElementById('commentary-drawer').style.display = 'none';

    // HUD & Tags
    document.getElementById('competition-tag').textContent = q.c;
    document.getElementById('tier-tag').textContent = q.d;

    if (this.currentMode === 'millionaire') {
      const currentPrize = this.millionairePrizes[this.currentIndex];
      document.getElementById('question-counter').textContent = `Question ${this.currentIndex + 1} of 15 ($${currentPrize.toLocaleString()})`;
      document.getElementById('hud-score-text').textContent = `$${this.currentBank.toLocaleString()}`;
      this.updateMoneyTreeHighlight(this.currentIndex + 1);

    } else if (this.currentMode === 'custom') {
      document.getElementById('question-counter').textContent = `Question ${this.currentIndex + 1} of ${this.questions.length}`;
      document.getElementById('hud-score-text').textContent = this.score.toLocaleString();

    } else {
      document.getElementById('question-counter').textContent = `Penalty ${this.currentIndex + 1} (Sudden Death)`;
      document.getElementById('hud-score-text').textContent = `${this.streak} 🔥`;
    }

    document.getElementById('question-title').textContent = q.q;

    // 4 Option Cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-opt-${i}`);
      const text = document.getElementById(`opt-text-${i}`);
      text.textContent = q.o[i] || '';
      card.className = "hologram-option-card";
      card.disabled = false;
    }

    this.startShotClock();
  }

  updateMoneyTreeHighlight(currentRungNum) {
    for (let r = 1; r <= 15; r++) {
      const rungEl = document.getElementById(`rung-${r}`);
      if (!rungEl) continue;
      rungEl.classList.remove('active', 'passed');

      if (r === currentRungNum) {
        rungEl.classList.add('active');
      } else if (r < currentRungNum) {
        rungEl.classList.add('passed');
      }
    }
  }

  startShotClock() {
    this.clearIntervalTimer();
    this.timerSeconds = 30;
    this.updateClockHUD();

    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      this.updateClockHUD();

      if (this.timerSeconds <= 5 && this.timerSeconds > 0) {
        this.playHeartbeat();
      }

      if (this.timerSeconds <= 0) {
        this.clearIntervalTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  clearIntervalTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateClockHUD() {
    const clockText = document.getElementById('hud-clock-text');
    const clockPill = document.getElementById('hud-clock-pill');
    clockText.textContent = `${this.timerSeconds}s`;

    if (this.timerSeconds <= 5) {
      clockPill.classList.add('danger');
    } else {
      clockPill.classList.remove('danger');
    }
  }

  // =========================================================
  // 5. ANSWER SELECTION & VALIDATION
  // =========================================================
  selectOption(idx) {
    if (!this.isAnsweringAllowed) return;
    this.isAnsweringAllowed = false;
    this.clearIntervalTimer();

    const q = this.questions[this.currentIndex];
    const chosenText = q.o[idx];
    const isCorrect = (chosenText || '').trim().toLowerCase() === q.a.trim().toLowerCase();

    this.shootBall(isCorrect);

    // Highlight Cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-opt-${i}`);
      const opt = q.o[i];
      card.disabled = true;

      if ((opt || '').trim().toLowerCase() === q.a.trim().toLowerCase()) {
        card.classList.add('correct');
      } else if (i === idx && !isCorrect) {
        card.classList.add('wrong');
      } else {
        card.classList.add('dimmed');
      }
    }

    const drawer = document.getElementById('commentary-drawer');
    const callout = document.getElementById('commentary-callout');
    const pts = document.getElementById('commentary-pts');
    const text = document.getElementById('commentary-text');

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      if (this.currentMode === 'millionaire') {
        const prizeWon = this.millionairePrizes[this.currentIndex];
        this.currentBank = prizeWon;
        this.score += prizeWon;

        callout.innerHTML = `<span style="color:#00f59b;">🏆 CORRECT! YOU WON $${prizeWon.toLocaleString()}</span>`;
        pts.textContent = `$${prizeWon.toLocaleString()}`;
        pts.style.color = '#00f59b';

      } else {
        const speedBonus = Math.floor((this.timerSeconds / 30) * 50);
        const points = 100 + speedBonus + (this.streak * 15);
        this.score += points;

        callout.innerHTML = `<span style="color:#00f59b;">⚽ TOP BINS! GOOOAL</span>`;
        pts.textContent = `+${points} PTS`;
        pts.style.color = '#00f59b';
      }

      if (this.streak >= 2) {
        document.getElementById('hud-streak-badge').style.display = 'inline-flex';
        document.getElementById('hud-streak-text').textContent = `${this.streak}x COMBO 🔥`;
      }

    } else {
      this.wrongCount++;
      this.streak = 0;
      document.getElementById('hud-streak-badge').style.display = 'none';

      if (this.currentMode === 'millionaire') {
        // Fall back to safety net: $32,000 or $1,000 or $0
        let guaranteed = 0;
        if (this.currentIndex >= 10) guaranteed = 32000;
        else if (this.currentIndex >= 5) guaranteed = 1000;
        this.currentBank = guaranteed;

        callout.innerHTML = `<span style="color:#ef4444;">❌ WRONG! YOU DROP TO $${guaranteed.toLocaleString()}</span>`;
        pts.textContent = `$${guaranteed.toLocaleString()} SAFE`;
        pts.style.color = '#ef4444';
        this.isGameOver = true;

      } else if (this.currentMode === 'survival') {
        callout.innerHTML = `<span style="color:#ef4444;">❌ GAME OVER (SUDDEN DEATH)</span>`;
        pts.textContent = "0 PTS";
        pts.style.color = '#ef4444';
        this.isGameOver = true;

      } else {
        callout.innerHTML = `<span style="color:#ef4444;">❌ OFF THE CROSSBAR!</span>`;
        pts.textContent = `+0 PTS`;
        pts.style.color = '#ef4444';
      }
    }

    text.textContent = `🎙️ Match Fact: ${q.e || `The correct answer is ${q.a}.`}`;

    setTimeout(() => {
      drawer.style.display = 'block';
    }, 400);
  }

  handleTimeout() {
    this.selectOption(-1);
  }

  nextQuestion() {
    if (this.isGameOver || this.currentIndex >= this.questions.length - 1) {
      this.finishMatch();
    } else {
      this.currentIndex++;
      this.renderQuestion();
    }
  }

  // =========================================================
  // 6. WALK AWAY & BANK (MILLIONAIRE EXCLUSIVE)
  // =========================================================
  walkAwayAndBank() {
    if (this.currentMode !== 'millionaire') return;
    if (confirm(`💼 Walk away now and lock in your $${this.currentBank.toLocaleString()} prize money?`)) {
      this.clearIntervalTimer();
      this.isGameOver = true;
      this.finishMatch();
    }
  }

  // =========================================================
  // 7. LIFELINES: 50:50, ASK THE FANS, FREEZE
  // =========================================================
  useLifeline5050() {
    if (!this.lifelines.fifty || !this.isAnsweringAllowed) return;
    this.lifelines.fifty = false;
    document.getElementById('btn-ll-5050').disabled = true;

    const q = this.questions[this.currentIndex];
    const wrongIndices = [];
    q.o.forEach((opt, idx) => {
      if (opt.trim().toLowerCase() !== q.a.trim().toLowerCase()) {
        wrongIndices.push(idx);
      }
    });

    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    toEliminate.forEach(idx => {
      document.getElementById(`card-opt-${idx}`).classList.add('eliminated');
    });

    this.playBallKickSound();
  }

  useLifelineFans() {
    if (!this.lifelines.fans || !this.isAnsweringAllowed) return;
    this.lifelines.fans = false;
    document.getElementById('btn-ll-fans').disabled = true;

    const q = this.questions[this.currentIndex];
    const correctIdx = q.o.findIndex(opt => opt.trim().toLowerCase() === q.a.trim().toLowerCase());

    // Generate realistic poll distribution favoring correct answer (65% - 85%)
    const correctPct = Math.floor(65 + Math.random() * 20);
    let remaining = 100 - correctPct;
    const pcts = [0, 0, 0, 0];
    pcts[correctIdx] = correctPct;

    const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctIdx);
    const p1 = Math.floor(Math.random() * remaining);
    remaining -= p1;
    const p2 = Math.floor(Math.random() * remaining);
    const p3 = remaining - p2;

    pcts[wrongIndices[0]] = p1;
    pcts[wrongIndices[1]] = p2;
    pcts[wrongIndices[2]] = p3;

    for (let i = 0; i < 4; i++) {
      document.getElementById(`poll-fill-${i}`).style.width = `${pcts[i]}%`;
      document.getElementById(`poll-pct-${i}`).textContent = `${pcts[i]}%`;
    }

    document.getElementById('modal-fan-poll').style.display = 'flex';
  }

  useLifelineFreeze() {
    if (!this.lifelines.freeze || !this.isAnsweringAllowed) return;
    this.lifelines.freeze = false;
    document.getElementById('btn-ll-freeze').disabled = true;

    this.timerSeconds += 15;
    this.updateClockHUD();
    document.getElementById('hud-clock-pill').style.borderColor = '#38bdf8';
    setTimeout(() => document.getElementById('hud-clock-pill').style.borderColor = '', 1500);
    this.playRefereeWhistle();
  }

  // =========================================================
  // 8. LOBBY MODAL & CUSTOM CONFIGURATION
  // =========================================================
  openLobbyModal() {
    document.getElementById('modal-lobby').style.display = 'flex';
  }

  closeLobbyModal() {
    document.getElementById('modal-lobby').style.display = 'none';
  }

  selectModeInLobby(mode) {
    ['millionaire', 'custom', 'survival'].forEach(m => {
      const card = document.getElementById(`card-mode-${m}`);
      const icon = card.querySelector('.mode-check-icon');
      if (m === mode) {
        card.classList.add('active');
        if (icon) icon.style.display = 'block';
      } else {
        card.classList.remove('active');
        if (icon) icon.style.display = 'none';
      }
    });

    const settingsSection = document.getElementById('lobby-custom-settings');
    if (mode === 'custom') {
      settingsSection.style.display = 'block';
    } else {
      settingsSection.style.display = 'none';
    }

    this.tempSelectedMode = mode;
  }

  setDifficultyInLobby(diff) {
    this.customDifficulty = diff;
    document.querySelectorAll('#lobby-diff-pills .filter-pill').forEach(btn => {
      if (btn.textContent.includes(diff)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  setCompetitionInLobby(comp) {
    this.customCompetition = comp;
    document.querySelectorAll('#lobby-comp-pills .filter-pill').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = Array.from(document.querySelectorAll('#lobby-comp-pills .filter-pill')).find(b => b.onclick.toString().includes(comp));
    if (activeBtn) activeBtn.classList.add('active');
  }

  applyLobbyAndStart() {
    this.currentMode = this.tempSelectedMode || this.currentMode;
    this.closeLobbyModal();
    this.startMatch();
  }

  // =========================================================
  // 9. EA FC / FUT ULTIMATE TEAM 3D ICON CARD REVEAL
  // =========================================================
  finishMatch() {
    this.clearIntervalTimer();
    const modal = document.getElementById('modal-results');
    modal.style.display = 'flex';

    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    let ovr = Math.round(82 + (acc * 0.12) + (this.score / 250) + (this.maxStreak * 0.8));
    if (this.currentMode === 'millionaire' && this.currentBank >= 1000000) ovr = 99;
    ovr = Math.max(80, Math.min(99, ovr));

    let title = "🏆 Ballon d'Or Tactician";
    if (ovr < 88) title = "🧢 Matchday Ticket Holder";
    else if (ovr < 93) title = "🔥 Premier League Baller";
    else if (ovr < 96) title = "⭐ Champions League Maestro";

    document.getElementById('fut-rating-num').textContent = ovr;
    document.getElementById('fut-rank-desc').textContent = title;

    if (this.currentMode === 'millionaire') {
      document.getElementById('fut-label-earnings').textContent = "PRIZE WON";
      document.getElementById('fut-stat-score').textContent = `$${this.currentBank.toLocaleString()}`;
    } else {
      document.getElementById('fut-label-earnings').textContent = "SCORE";
      document.getElementById('fut-stat-score').textContent = this.score.toLocaleString();
    }

    document.getElementById('fut-stat-acc').textContent = `${acc}%`;
    document.getElementById('fut-stat-streak').textContent = `${this.maxStreak} 🔥`;
    document.getElementById('fut-stat-speed').textContent = `${Math.min(99, 85 + this.maxStreak * 2)} PAC`;

    if (window.confetti) {
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
    }
  }

  resetGame() {
    document.getElementById('modal-results').style.display = 'none';
    this.startMatch();
  }

  shareScorecard() {
    const ovr = document.getElementById('fut-rating-num').textContent;
    const prize = document.getElementById('fut-stat-score').textContent;
    const text = `⚽ FootyQuiz 3D\n👑 Rating: ${ovr} OVR\n💰 Prize: ${prize}\n\nTest your ball knowledge: quiz.bhuwanadhikari007.com.np`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert("3D Scorecard copied to clipboard! Share it with your friends.");
      });
    } else {
      alert(text);
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        this.selectOption(parseInt(e.key) - 1);
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        if (document.getElementById('commentary-drawer').style.display === 'block') {
          e.preventDefault();
          this.nextQuestion();
        }
      }
    });
  }
}

// Single Global Instance
window.app = new Footy3DBroadcastApp();
