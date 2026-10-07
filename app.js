/**
 * FootyQuiz Pro - Next-Gen 3D Broadcast Matchday Engine
 * Features Three.js 3D Stadium & Goal Shootout Physics, Web Audio Synthesizer,
 * Lifelines (50:50, +15s, VAR), Holographic 3D Cards, and EA FC 3D ICON Card Reveal.
 */

class Footy3DBroadcastApp {
  constructor() {
    // Game Data
    this.allQuestions = [];
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // State
    this.isAnsweringAllowed = false;
    this.selectedOption = null;
    this.activeCompetition = 'all';
    this.activeDifficulty = 'Very Easy';

    // Lifelines (1 use per match)
    this.lifelines = {
      fifty: true,
      freeze: true,
      var: true
    };
    this.varActive = false;

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

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050811, 0.035);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.6, 5.2);
    this.camera.lookAt(0, 1.2, -3);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // 1. Stadium Grass Pitch
    const pitchGeo = new THREE.PlaneGeometry(60, 60);
    const pitchMat = new THREE.MeshStandardMaterial({
      color: 0x071e12,
      roughness: 0.85,
      metalness: 0.1
    });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // 2. White Touchlines / Penalty Box Markings
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const penaltyLine = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.08), lineMat);
    penaltyLine.rotation.x = -Math.PI / 2;
    penaltyLine.position.set(0, 0.01, 1.5);
    this.scene.add(penaltyLine);

    // 3. Goal Frame (Posts + Crossbar)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
    
    // Left Post
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 16), postMat);
    leftPost.position.set(-2.8, 1.3, -4);
    this.scene.add(leftPost);

    // Right Post
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 16), postMat);
    rightPost.position.set(2.8, 1.3, -4);
    this.scene.add(rightPost);

    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.68, 16), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 2.6, -4);
    this.scene.add(crossbar);

    // 4. Goal Net Mesh
    const netGeo = new THREE.PlaneGeometry(5.6, 2.6, 14, 8);
    const netMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    this.netMesh = new THREE.Mesh(netGeo, netMat);
    this.netMesh.position.set(0, 1.3, -4.5);
    this.scene.add(this.netMesh);

    // 5. Photorealistic 3D Soccer Ball
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
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.25,
      metalness: 0.15
    });

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), ballMat);
    this.ball.position.set(this.ballInitialPos.x, this.ballInitialPos.y, this.ballInitialPos.z);
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    // 6. Stadium Floodlights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Green Pitch Floodlight
    const light1 = new THREE.SpotLight(0x00f59b, 2.5, 40, Math.PI / 4, 0.4);
    light1.position.set(-8, 12, 6);
    light1.target = this.ball;
    this.scene.add(light1);
    this.floodlights.push(light1);

    // Cyan Stadium Floodlight
    const light2 = new THREE.SpotLight(0x38bdf8, 2.0, 40, Math.PI / 4, 0.4);
    light2.position.set(8, 12, 6);
    light2.target = this.ball;
    this.scene.add(light2);
    this.floodlights.push(light2);

    // 7. Floating Stadium Atmosphere Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 20;
      particlePositions[i + 1] = Math.random() * 8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f59b,
      size: 0.045,
      transparent: true,
      opacity: 0.6
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(particles);

    // Resize Handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Render Animation Loop
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Gentle ball rotation when idle
      if (!this.isShooting && this.ball) {
        this.ball.rotation.y += 0.005;
        this.ball.rotation.x += 0.003;
      }

      // Gentle floating particles
      particles.rotation.y = time * 0.03;

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  // 3D BALL SHOOTOUT PHYSICS
  shootBall(isCorrect) {
    if (!this.ball || this.isShooting) return;
    this.isShooting = true;

    const startX = this.ball.position.x;
    const startY = this.ball.position.y;
    const startZ = this.ball.position.z;

    // Target: Top corner goal or crossbar rebound
    let targetX = 2.0;
    let targetY = 2.2;
    let targetZ = -4.2;

    if (!isCorrect) {
      // Direct Crossbar Clang
      targetX = 0.2;
      targetY = 2.65;
      targetZ = -4.0;
    }

    let progress = 0;
    const duration = 40; // ~650ms

    this.playBallKickSound();

    const interval = setInterval(() => {
      progress++;
      const t = progress / duration;

      // Parabolic Arc
      this.ball.position.x = startX + (targetX - startX) * t;
      this.ball.position.z = startZ + (targetZ - startZ) * t;
      this.ball.position.y = startY + (targetY - startY) * t + Math.sin(t * Math.PI) * 1.2;

      // High spin
      this.ball.rotation.x -= 0.35;
      this.ball.rotation.z += 0.15;

      if (progress >= duration) {
        clearInterval(interval);

        if (isCorrect) {
          // GOAL IN TOP CORNER
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
          // CROSSBAR REBOUND
          this.playCrossbarClangSound();
          this.playRefereeWhistle();
          this.flashFloodlights(0xef4444);

          // Rebound back
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
  // 2. REALISTIC AUDIO SYNTHESIZER (ZERO EXTERNAL ASSETS)
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

  // Deep Punchy Ball Kick
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

  // Metallic Crossbar "CLANG!"
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

  // Goal Net Ripple Swoosh
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

  // Stadium Goal Roar (Harmonic Chord)
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

  // Referee Whistle
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

  // =========================================================
  // 3. 3D CARD TILT PHYSICS (MOUSE / TOUCH)
  // =========================================================
  initCardTiltEffects() {
    // 3D Tilt for FUT Icon Card
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
  // 4. LOAD 10,000 QUESTIONS DATASET
  // =========================================================
  async loadQuestions() {
    try {
      const res = await fetch('questions.json');
      if (!res.ok) throw new Error("Could not load questions.json");
      this.allQuestions = await res.json();
      console.log(`Loaded ${this.allQuestions.length} football questions!`);
    } catch (e) {
      console.warn("Using verified fallback questions", e);
      this.allQuestions = [
        { id: 1, c: "FIFA World Cup", d: "Very Easy", q: "Which country won the 2022 FIFA World Cup in Qatar?", o: ["Argentina", "France", "Croatia", "Morocco"], a: "Argentina", e: "Lionel Messi led Argentina to World Cup glory in Qatar 2022." },
        { id: 2, c: "La Liga", d: "Very Easy", q: "Which club does Lionel Messi hold the all-time scoring record for?", o: ["FC Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"], a: "FC Barcelona", e: "Lionel Messi scored 672 goals for FC Barcelona." },
        { id: 3, c: "Premier League", d: "Very Easy", q: "Which club is known as 'The Gunners'?", o: ["Arsenal", "Chelsea", "Liverpool", "Manchester United"], a: "Arsenal", e: "Arsenal was founded in 1886 by munitions workers at the Royal Arsenal." },
        { id: 4, c: "Premier League", d: "Very Easy", q: "What color home shirts do Manchester United and Liverpool both wear?", o: ["Red", "Blue", "White", "Yellow"], a: "Red", e: "Both Manchester United and Liverpool wear red." },
        { id: 5, c: "FIFA World Cup", d: "Very Easy", q: "How many World Cup trophies has Brazil won?", o: ["5", "3", "4", "6"], a: "5", e: "Brazil is the only nation with 5 World Cup titles." }
      ];
    }
  }

  // =========================================================
  // 5. MATCH KICKOFF & 30-SECOND SHOT CLOCK
  // =========================================================
  startMatch() {
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // Reset Lifelines
    this.lifelines = { fifty: true, freeze: true, var: true };
    this.varActive = false;
    document.getElementById('btn-ll-5050').disabled = false;
    document.getElementById('btn-ll-freeze').disabled = false;
    document.getElementById('btn-ll-var').disabled = false;

    // Filter questions
    let pool = this.allQuestions;
    if (this.activeCompetition !== 'all') {
      pool = pool.filter(q => q.c === this.activeCompetition);
    }
    if (this.activeDifficulty !== 'all') {
      const diffPool = pool.filter(q => q.d === this.activeDifficulty);
      if (diffPool.length >= 10) pool = diffPool;
    }

    this.questions = [...pool].sort(() => 0.5 - Math.random()).slice(0, 10);
    this.renderQuestion();
  }

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q) {
      this.finishMatch();
      return;
    }

    this.isAnsweringAllowed = true;
    this.selectedOption = null;

    // Hide commentary drawer
    document.getElementById('commentary-drawer').style.display = 'none';

    // HUD Updates
    document.getElementById('competition-tag').textContent = q.c;
    document.getElementById('tier-tag').textContent = q.d;
    document.getElementById('question-counter').textContent = `Question ${this.currentIndex + 1} of ${this.questions.length}`;
    document.getElementById('question-title').textContent = q.q;

    // Render 4 Cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-opt-${i}`);
      const text = document.getElementById(`opt-text-${i}`);
      text.textContent = q.o[i] || '';
      card.className = "hologram-option-card";
      card.disabled = false;
    }

    this.startShotClock();
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
  // 6. ANSWER SELECTION & GOAL REACTION
  // =========================================================
  selectOption(idx) {
    if (!this.isAnsweringAllowed) return;
    this.isAnsweringAllowed = false;
    this.clearIntervalTimer();

    const q = this.questions[this.currentIndex];
    const chosenText = q.o[idx];
    const isCorrect = (chosenText || '').trim().toLowerCase() === q.a.trim().toLowerCase();

    // Trigger 3D Shootout in Stadium!
    this.shootBall(isCorrect);

    // VAR Check Lifeline Intervene
    if (!isCorrect && this.varActive) {
      this.varActive = false;
      alert("🛡️ VAR INTERVENTION! Referee overturned the strike. Pick another option!");
      document.getElementById(`card-opt-${idx}`).classList.add('eliminated');
      this.isAnsweringAllowed = true;
      this.startShotClock();
      return;
    }

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

      // Speed bonus
      const speedBonus = Math.floor((this.timerSeconds / 30) * 50);
      const points = 100 + speedBonus + (this.streak * 15);
      this.score += points;

      callout.innerHTML = `<span style="color:#00f59b;">⚽ TOP BINS! GOOOAL</span>`;
      pts.textContent = `+${points} PTS`;
      pts.style.color = '#00f59b';

      // Update Streak Badge
      if (this.streak >= 2) {
        document.getElementById('hud-streak-badge').style.display = 'inline-flex';
        document.getElementById('hud-streak-text').textContent = `${this.streak}x COMBO 🔥`;
      }

    } else {
      this.wrongCount++;
      this.streak = 0;
      document.getElementById('hud-streak-badge').style.display = 'none';

      callout.innerHTML = `<span style="color:#ef4444;">❌ OFF THE CROSSBAR!</span>`;
      pts.textContent = `+0 PTS`;
      pts.style.color = '#ef4444';
    }

    document.getElementById('hud-score-text').textContent = this.score.toLocaleString();
    text.textContent = `🎙️ Match Fact: ${q.e || `The correct answer is ${q.a}.`}`;

    // Reveal commentary drawer
    setTimeout(() => {
      drawer.style.display = 'block';
    }, 400);
  }

  handleTimeout() {
    this.selectOption(-1);
  }

  nextQuestion() {
    if (this.currentIndex >= this.questions.length - 1) {
      this.finishMatch();
    } else {
      this.currentIndex++;
      this.renderQuestion();
    }
  }

  // =========================================================
  // 7. ADDICTIVE MATCHDAY LIFELINES
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

    // Eliminate 2 random wrong options
    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    toEliminate.forEach(idx => {
      document.getElementById(`card-opt-${idx}`).classList.add('eliminated');
    });

    this.playBallKickSound();
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

  useLifelineVar() {
    if (!this.lifelines.var || !this.isAnsweringAllowed) return;
    this.lifelines.var = false;
    this.varActive = true;
    document.getElementById('btn-ll-var').disabled = true;
    alert("🛡️ VAR Shield Active: If your next answer is wrong, referee will give you a second chance!");
  }

  // =========================================================
  // 8. KEYBOARD HOTKEYS (1, 2, 3, 4 & Space)
  // =========================================================
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

  // =========================================================
  // 9. EA FC / FUT ULTIMATE TEAM 3D ICON CARD REVEAL
  // =========================================================
  finishMatch() {
    this.clearIntervalTimer();
    const modal = document.getElementById('modal-results');
    modal.style.display = 'flex';

    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    // Overall Rating (FUT OVR 82 - 99)
    let ovr = Math.round(82 + (acc * 0.12) + (this.score / 250) + (this.maxStreak * 0.8));
    ovr = Math.max(80, Math.min(99, ovr));

    let title = "🏆 Ballon d'Or Tactician";
    if (ovr < 88) title = "🧢 Matchday Season Ticket Holder";
    else if (ovr < 93) title = "🔥 Premier League Baller";
    else if (ovr < 96) title = "⭐ Champions League Maestro";

    document.getElementById('fut-rating-num').textContent = ovr;
    document.getElementById('fut-rank-desc').textContent = title;
    document.getElementById('fut-stat-score').textContent = this.score.toLocaleString();
    document.getElementById('fut-stat-acc').textContent = `${acc}%`;
    document.getElementById('fut-stat-streak').textContent = `${this.maxStreak} 🔥`;
    document.getElementById('fut-stat-speed').textContent = `${Math.min(99, 85 + this.maxStreak * 2)} PAC`;

    if (window.confetti) {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    }
  }

  resetGame() {
    document.getElementById('modal-results').style.display = 'none';
    this.startMatch();
  }

  shareScorecard() {
    const ovr = document.getElementById('fut-rating-num').textContent;
    const score = document.getElementById('fut-stat-score').textContent;
    const text = `⚽ FootyQuiz 3D Matchday\n👑 Certified Rating: ${ovr} OVR\n🎯 Match Score: ${score} PTS\n\nCan you beat my Ball Knowledge? Play now at: quiz.bhuwanadhikari007.com.np`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert("3D Card Scorecard copied to clipboard! Share it with your friends.");
      });
    } else {
      alert(text);
    }
  }

  cycleCompetition() {
    const comps = ["all", "FIFA World Cup", "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
    const cur = comps.indexOf(this.activeCompetition);
    this.activeCompetition = comps[(cur + 1) % comps.length];
    document.getElementById('footer-comp-label').textContent = this.activeCompetition === 'all' ? 'All Leagues (10,000 Questions)' : this.activeCompetition;
    this.startMatch();
  }

  cycleDifficulty() {
    const diffs = ["Very Easy", "Easy", "Medium", "Hard", "Very Hard", "Elite"];
    const cur = diffs.indexOf(this.activeDifficulty);
    this.activeDifficulty = diffs[(cur + 1) % diffs.length];
    document.getElementById('footer-diff-label').textContent = `Tier: ${this.activeDifficulty}`;
    this.startMatch();
  }
}

// Global Single Instance
window.app = new Footy3DBroadcastApp();
