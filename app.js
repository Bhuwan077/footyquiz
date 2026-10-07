/**
 * FootyQuiz Pro - 3D Liquid Glass Engine
 * Features Three.js 3D Soccer Ball, Realistic 3D Tilt Physics, 30s Shot Clock,
 * 10,000 Questions Client-Side Engine, Web Audio Synthesizer, and Dynamic Island.
 */

class LiquidFootyApp {
  constructor() {
    this.questions = [];
    this.allQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    this.selectedOptionIndex = null;
    this.isAnsweringAllowed = false;
    this.isConfirmed = false;

    // Filters
    this.activeCompetition = 'all';
    this.activeDifficulty = 'Very Easy';

    // 30s Timer
    this.timerSeconds = 30;
    this.timerInterval = null;

    // 3D Tilt State
    this.isTiltActive = true;

    // Audio Engine
    this.soundEnabled = true;
    this.audioCtx = null;

    // Three.js State
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ballMesh = null;
    this.ballParticles = null;

    this.init();
  }

  async init() {
    this.init3DTilt();
    this.initThreeBall();
    this.initSliderDrag();
    this.initKeyboard();
    lucide.createIcons();

    await this.loadQuestions();
    this.startQuiz();
  }

  // =========================================================
  // 1. THREE.JS 3D SOCCER BALL WITH GLOW & PARTICLES
  // =========================================================
  initThreeBall() {
    const container = document.getElementById('three-canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    const width = 120;
    const height = 120;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 2.8;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Procedural Soccer Ball Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Hexagonal / Pentagonal Star Ball Texture
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#0f172a';
    
    const drawPentagon = (x, y, r) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    drawPentagon(256, 256, 68);
    drawPentagon(80, 100, 52);
    drawPentagon(432, 100, 52);
    drawPentagon(120, 412, 52);
    drawPentagon(392, 412, 52);

    const ballTexture = new THREE.CanvasTexture(canvas);

    // Ball Geometry
    const geometry = new THREE.SphereGeometry(0.85, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.25,
      metalness: 0.1,
      bumpScale: 0.05
    });

    this.ballMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.ballMesh);

    // Stadium Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const floodLight = new THREE.DirectionalLight(0x00f59b, 1.2);
    floodLight.position.set(2, 3, 2);
    this.scene.add(floodLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-2, -1, 1);
    this.scene.add(rimLight);

    // Animation Loop
    let spinSpeed = 0.008;
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.ballMesh) {
        this.ballMesh.rotation.y += spinSpeed;
        this.ballMesh.rotation.x += spinSpeed * 0.4;
      }
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  triggerGoalBallSpin() {
    if (!this.ballMesh) return;
    let count = 0;
    const interval = setInterval(() => {
      this.ballMesh.rotation.y += 0.15;
      this.ballMesh.rotation.x += 0.08;
      count++;
      if (count > 25) clearInterval(interval);
    }, 16);
  }

  triggerMissBallWobble() {
    if (!this.ballMesh) return;
    let count = 0;
    const originalX = this.ballMesh.position.x;
    const interval = setInterval(() => {
      this.ballMesh.position.x = originalX + (Math.sin(count * 2) * 0.1);
      count++;
      if (count > 12) {
        this.ballMesh.position.x = originalX;
        clearInterval(interval);
      }
    }, 20);
  }

  // =========================================================
  // 2. REALISTIC 3D PHONE TILT & SPECULAR GLARE
  // =========================================================
  init3DTilt() {
    const frame = document.getElementById('phone-frame');
    const glare = document.getElementById('phone-glare');
    if (!frame) return;

    window.addEventListener('mousemove', (e) => {
      if (!this.isTiltActive) return;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normX = (e.clientX - centerX) / centerX;
      const normY = (e.clientY - centerY) / centerY;

      const rotY = normX * 12; // -12deg to +12deg
      const rotX = -normY * 12; // -12deg to +12deg

      frame.style.transform = `rotateY(${rotY.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) translateZ(10px)`;

      // Specular glare reflection moving across glass
      if (glare) {
        const glareX = Math.round(50 + (normX * 35));
        const glareY = Math.round(30 + (normY * 35));
        glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 55%)`;
      }
    });

    window.addEventListener('mouseleave', () => {
      if (frame) frame.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(0px)';
    });
  }

  toggle3DTilt() {
    this.isTiltActive = !this.isTiltActive;
    const frame = document.getElementById('phone-frame');
    const btn = document.getElementById('btn-toggle-3d');
    if (frame) {
      frame.style.transform = 'rotateY(0deg) rotateX(0deg)';
    }
    if (btn) {
      btn.querySelector('span').textContent = `3D Tilt: ${this.isTiltActive ? 'Active' : 'Off'}`;
    }
  }

  // =========================================================
  // 3. SOUND SYNTHESIZER
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

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.18) {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playGoalCheer() {
    this.playTone(523.25, 'triangle', 0.15, 0.2); // C5
    setTimeout(() => this.playTone(659.25, 'triangle', 0.18, 0.2), 70); // E5
    setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.22), 140); // G5
    setTimeout(() => this.playTone(1046.50, 'sine', 0.4, 0.25), 210); // C6
  }

  playMissTone() {
    this.playTone(220, 'sawtooth', 0.2, 0.18);
    setTimeout(() => this.playTone(174.61, 'sawtooth', 0.35, 0.2), 100);
  }

  playTickTone() {
    this.playTone(880, 'sine', 0.04, 0.05);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const label = document.getElementById('voice-label');
    if (label) label.textContent = this.soundEnabled ? 'voice' : 'muted';
    this.playTone(this.soundEnabled ? 523 : 260, 'sine', 0.1);
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
      console.warn("Using fallback questions pool", e);
      // Rock-solid fallback casual questions
      this.allQuestions = [
        { id: 1, c: "FIFA World Cup", d: "Very Easy", q: "Which country won the 2022 FIFA World Cup in Qatar?", o: ["Argentina", "France", "Croatia", "Morocco"], a: "Argentina", e: "Argentina won the 2022 World Cup after defeating France in a legendary penalty shootout." },
        { id: 2, c: "La Liga", d: "Very Easy", q: "Which club does Lionel Messi hold the all-time scoring record for?", o: ["FC Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"], a: "FC Barcelona", e: "Lionel Messi scored an astronomical 672 goals for FC Barcelona." },
        { id: 3, c: "Premier League", d: "Very Easy", q: "Which English club is known as 'The Gunners'?", o: ["Arsenal", "Chelsea", "Liverpool", "Manchester United"], a: "Arsenal", e: "Arsenal was founded in 1886 by munitions workers at the Royal Arsenal in Woolwich." },
        { id: 4, c: "Premier League", d: "Very Easy", q: "What color home shirts do Manchester United and Liverpool both wear?", o: ["Red", "Blue", "White", "Yellow"], a: "Red", e: "Both Manchester United and Liverpool famously wear iconic red home kits." },
        { id: 5, c: "FIFA World Cup", d: "Very Easy", q: "How many FIFA World Cup trophies has Brazil won in total?", o: ["5", "3", "4", "6"], a: "5", e: "Brazil is the most successful nation in World Cup history with 5 titles (1958, 1962, 1970, 1994, 2002)." }
      ];
    }
  }

  // =========================================================
  // 5. QUIZ RUNTIME & 30-SECOND SHOT CLOCK
  // =========================================================
  startQuiz() {
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // Filter by competition and difficulty
    let pool = this.allQuestions;
    if (this.activeCompetition !== 'all') {
      pool = pool.filter(q => q.c === this.activeCompetition);
    }
    if (this.activeDifficulty !== 'all') {
      const diffPool = pool.filter(q => q.d === this.activeDifficulty);
      if (diffPool.length >= 10) pool = diffPool;
    }

    // Shuffle and pick 10
    this.questions = [...pool].sort(() => 0.5 - Math.random()).slice(0, 10);
    this.renderQuestion();
  }

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q) {
      this.finishQuiz();
      return;
    }

    this.selectedOptionIndex = null;
    this.isAnsweringAllowed = true;
    this.isConfirmed = false;
    this.resetSlider();

    // Close any drawers
    document.getElementById('drawer-feedback').style.display = 'none';
    document.getElementById('modal-results').style.display = 'none';

    // Subtitle & Heading
    document.getElementById('quiz-subtitle').textContent = `Question ${this.currentIndex + 1} / ${this.questions.length} • ${q.d}`;
    document.getElementById('quiz-heading').textContent = q.q;

    // Reset 4 cards
    const cardLetters = ['01', '02', '03', '04'];
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-${i + 1}`);
      const cardNum = document.getElementById(`card-num-${i + 1}`);
      const cardText = document.getElementById(`card-text-${i + 1}`);

      cardNum.textContent = cardLetters[i];
      cardText.textContent = q.o[i] || '';

      card.className = "quiz-card liquid-glass anim-fade-up";
      card.style.animationDelay = `${0.35 + (i * 0.08)}s`;
    }

    this.startShotClock();
  }

  startShotClock() {
    this.clearIntervalTimer();
    this.timerSeconds = 30;
    this.updateTimerHUD();

    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      this.updateTimerHUD();

      if (this.timerSeconds <= 5 && this.timerSeconds > 0) {
        this.playTickTone();
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

  updateTimerHUD() {
    const islandTimer = document.getElementById('island-timer');
    const badgeText = document.getElementById('header-badge-text');

    if (islandTimer) islandTimer.textContent = `${this.timerSeconds}s`;
    if (badgeText) badgeText.textContent = `FootyQuiz • ${this.timerSeconds}s`;
  }

  // =========================================================
  // 6. CARD CLICK & ANSWER VALIDATION
  // =========================================================
  handleCardClick(idx) {
    if (!this.isAnsweringAllowed || this.isConfirmed) return;

    this.selectedOptionIndex = idx;

    // Toggle card selection visually
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-${i + 1}`);
      if (i === idx) {
        card.classList.add('liquid-glass-selected');
      } else {
        card.classList.remove('liquid-glass-selected');
      }
    }

    this.playTone(440, 'sine', 0.08, 0.1);
    document.getElementById('slide-text').textContent = "Confirm (Tap or Slide)";
  }

  confirmAnswer() {
    if (this.selectedOptionIndex === null || this.isConfirmed) return;
    this.isConfirmed = true;
    this.isAnsweringAllowed = false;
    this.clearIntervalTimer();

    const q = this.questions[this.currentIndex];
    const chosenText = q.o[this.selectedOptionIndex];
    const isCorrect = (chosenText || '').trim().toLowerCase() === q.a.trim().toLowerCase();

    // Reveal Green / Red Cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`card-${i + 1}`);
      const optText = q.o[i];
      card.classList.remove('liquid-glass-selected');

      if ((optText || '').trim().toLowerCase() === q.a.trim().toLowerCase()) {
        card.classList.add('liquid-glass-correct');
      } else if (i === this.selectedOptionIndex && !isCorrect) {
        card.classList.add('liquid-glass-wrong');
      }
    }

    const drawer = document.getElementById('drawer-feedback');
    const titleEl = document.getElementById('feedback-result-title');
    const ptsBadge = document.getElementById('feedback-pts-badge');
    const expEl = document.getElementById('feedback-explanation');

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      // Speed bonus: up to +50 based on 30s
      const speedBonus = Math.floor((this.timerSeconds / 30) * 50);
      const points = 100 + speedBonus + (this.streak * 10);
      this.score += points;

      this.playGoalCheer();
      this.triggerGoalBallSpin();

      if (window.confetti) {
        confetti({ particleCount: 40, spread: 55, origin: { y: 0.65 } });
      }

      titleEl.innerHTML = `<span>GOOOAL! Correct</span>`;
      titleEl.style.color = '#00f59b';
      ptsBadge.textContent = `+${points} PTS`;
      ptsBadge.style.color = '#00f59b';

    } else {
      this.wrongCount++;
      this.streak = 0;

      this.playMissTone();
      this.triggerMissBallWobble();

      titleEl.innerHTML = `<span>OFF TARGET!</span>`;
      titleEl.style.color = '#ef4444';
      ptsBadge.textContent = `+0 PTS`;
      ptsBadge.style.color = '#ef4444';
    }

    expEl.textContent = q.e || `The correct answer is ${q.a}.`;
    drawer.style.display = 'block';
  }

  handleTimeout() {
    this.selectedOptionIndex = -1;
    this.confirmAnswer();
  }

  nextQuestion() {
    if (this.currentIndex >= this.questions.length - 1) {
      this.finishQuiz();
    } else {
      this.currentIndex++;
      this.renderQuestion();
    }
  }

  // =========================================================
  // 7. DRAGGABLE SLIDE-TO-CONFIRM + 1-TAP TRACK CONFIRM
  // =========================================================
  initSliderDrag() {
    const track = document.getElementById('slide-track');
    const thumb = document.getElementById('slide-thumb');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    const maxDrag = 375 - 48 - 44 - 12; // ~271px

    const onPointerDown = (e) => {
      if (this.selectedOptionIndex === null || this.isConfirmed) return;
      isDragging = true;
      startX = e.clientX || (e.touches && e.touches[0].clientX);
      thumb.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const deltaX = clientX - startX;
      currentX = Math.max(0, Math.min(maxDrag, deltaX));
      thumb.style.transform = `translateX(${currentX}px)`;
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      // If dragged past 80%, snap to end and confirm!
      if (currentX >= maxDrag * 0.8) {
        thumb.style.transform = `translateX(${maxDrag}px)`;
        setTimeout(() => this.confirmAnswer(), 80);
      } else {
        // Snap back
        thumb.style.transform = `translateX(0px)`;
      }
    };

    thumb.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  handleTrackTap(e) {
    if (this.selectedOptionIndex === null || this.isConfirmed) return;
    const thumb = document.getElementById('slide-thumb');
    const maxDrag = 375 - 48 - 44 - 12;
    if (thumb) {
      thumb.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      thumb.style.transform = `translateX(${maxDrag}px)`;
      setTimeout(() => {
        thumb.style.transition = '';
        this.confirmAnswer();
      }, 250);
    } else {
      this.confirmAnswer();
    }
  }

  resetSlider() {
    const thumb = document.getElementById('slide-thumb');
    const text = document.getElementById('slide-text');
    if (thumb) thumb.style.transform = 'translateX(0px)';
    if (text) text.textContent = "Done";
  }

  // =========================================================
  // 8. KEYBOARD SHORTCUTS (1, 2, 3, 4 & Space)
  // =========================================================
  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        this.handleCardClick(parseInt(e.key) - 1);
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('drawer-feedback').style.display === 'block') {
          this.nextQuestion();
        } else if (this.selectedOptionIndex !== null && !this.isConfirmed) {
          this.confirmAnswer();
        }
      }
    });
  }

  // =========================================================
  // 9. MATCH REPORT & CERTIFIED FOOTBALL IQ
  // =========================================================
  finishQuiz() {
    this.clearIntervalTimer();
    const modal = document.getElementById('modal-results');
    modal.style.display = 'flex';

    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    // Certified IQ Formula
    let iq = Math.round(85 + (acc * 0.45) + (this.score / 160) + (this.maxStreak * 2));
    iq = Math.max(80, Math.min(160, iq));

    let title = "🏆 Ballon d'Or Tactician";
    if (iq < 100) title = "📺 Casual Halftime Viewer";
    else if (iq < 118) title = "🧢 Matchday Ticket Holder";
    else if (iq < 132) title = "🔥 Premier League Regular";
    else if (iq < 148) title = "⭐ Champions League Maestro";

    document.getElementById('res-iq-num').textContent = iq;
    document.getElementById('res-iq-title').textContent = title;
    document.getElementById('res-score').textContent = this.score.toLocaleString();
    document.getElementById('res-acc').textContent = `${acc}%`;
    document.getElementById('res-combo').textContent = `${this.maxStreak} 🔥`;

    if (window.confetti) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
  }

  restartQuiz() {
    this.startQuiz();
  }

  shareScorecard() {
    const iq = document.getElementById('res-iq-num').textContent;
    const score = document.getElementById('res-score').textContent;
    const text = `⚽ FootyQuiz Pro 3D\n🧠 Football IQ: ${iq}\n🎯 Score: ${score} PTS\n\nTest your ball knowledge: quiz.bhuwanadhikari007.com.np`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert("Scorecard copied to clipboard! Share it with your squad.");
      });
    } else {
      alert(text);
    }
  }

  toggleIslandExpand() {
    const island = document.getElementById('dynamic-island');
    island.classList.toggle('expanded');
  }

  openCategoryMenu() {
    const leagues = ["all", "FIFA World Cup", "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
    const curIdx = leagues.indexOf(this.activeCompetition);
    const nextIdx = (curIdx + 1) % leagues.length;
    this.activeCompetition = leagues[nextIdx];
    
    const label = document.getElementById('label-active-league');
    if (label) label.textContent = this.activeCompetition === 'all' ? 'All Leagues' : this.activeCompetition;
    this.startQuiz();
  }
}

// Instantiate
window.app = new LiquidFootyApp();
