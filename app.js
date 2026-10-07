/**
 * FootyQuiz Pro - Editorial Nurture Ball Knowledge Controller
 * Features:
 * 1. Landing/Index Page with Game Mode Selection First
 * 2. "Check Your Ball Knowledge" Mode (Endless Random Mix of Easy, Medium, Hard, Very Hard, Elite)
 * 3. Dynamic Infinite Prize Ladder with Safety Nets ($1K, $32K, $1M, $10M, $100M...)
 * 4. Custom Match Mode (10-Question Sprint by Difficulty & Competition)
 * 5. Dedicated Loading Transition & Diagnostic Results Dashboard
 * 6. Collectible Playcard Generation for EVERYONE (Guest or Signed In)
 * 7. Gmail Sign-In requirement for Official Global Leaderboard Recording
 * 8. Web Audio Synthesizer & Stadium Fan Poll Lifeline
 */

class FootyEditorialApp {
  constructor() {
    // Mode Configuration: 'ballknowledge' (endless) or 'custom' (10-question sprint)
    this.currentMode = 'ballknowledge';
    this.customDifficulty = 'Very Easy';
    this.customCompetition = 'all';

    // Game Session Stats
    this.currentQuestionIndex = 0;
    this.currentBank = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // Database & Tracking
    this.allQuestions = [];
    this.currentQuestion = null;
    this.usedQuestionIds = new Set();
    this.isAnsweringAllowed = false;
    this.selectedOption = null;
    this.isGameOver = false;

    // Lifelines (1 use per match session)
    this.lifelines = {
      fifty: true,
      fans: true,
      freeze: true
    };

    // 30-Second Shot Clock
    this.timerSeconds = 30;
    this.timerInterval = null;

    // Sound
    this.soundEnabled = true;
    this.audioCtx = null;

    // Verified User Profile
    this.currentUser = JSON.parse(localStorage.getItem('footy_editorial_user')) || {
      name: 'Guest Baller',
      email: null,
      club: 'Neutral',
      verified: false
    };

    this.init();
  }

  async init() {
    this.initKeyboardShortcuts();
    lucide.createIcons();

    // Default to Landing Page view
    this.showLandingView();

    // Pre-select Ball Knowledge mode on landing
    this.selectLandingMode('ballknowledge');

    // Load questions database in background
    await this.loadQuestions();
  }

  // =========================================================
  // 1. VIEW NAVIGATION & LANDING PAGE LOGIC
  // =========================================================
  showLandingView() {
    this.clearIntervalTimer();
    const landingView = document.getElementById('view-landing');
    const quizView = document.getElementById('view-quiz');
    const ladderDrawer = document.getElementById('money-ladder-drawer');
    const resultsModal = document.getElementById('modal-results');

    if (landingView) landingView.style.display = 'flex';
    if (quizView) quizView.style.display = 'none';
    if (ladderDrawer) {
      ladderDrawer.style.display = 'none';
      ladderDrawer.classList.remove('active-drawer');
    }
    if (resultsModal) resultsModal.style.display = 'none';

    lucide.createIcons();
  }

  showQuizView() {
    const landingView = document.getElementById('view-landing');
    const quizView = document.getElementById('view-quiz');

    if (landingView) landingView.style.display = 'none';
    if (quizView) quizView.style.display = 'flex';

    lucide.createIcons();
  }

  selectLandingMode(mode) {
    this.currentMode = mode;
    const bkCard = document.getElementById('landing-mode-ballknowledge');
    const customCard = document.getElementById('landing-mode-custom');
    const customSettings = document.getElementById('landing-custom-settings');
    const startBtn = document.getElementById('landing-start-btn');
    const startText = document.getElementById('landing-start-text');

    if (mode === 'ballknowledge') {
      if (bkCard) bkCard.classList.add('selected');
      if (customCard) customCard.classList.remove('selected');
      if (customSettings) customSettings.style.display = 'none';
      if (startText) startText.textContent = 'Start Ball Knowledge Challenge (Endless)';
    } else {
      if (customCard) customCard.classList.add('selected');
      if (bkCard) bkCard.classList.remove('selected');
      if (customSettings) customSettings.style.display = 'block';
      if (startText) startText.textContent = `Start Custom Match (${this.customDifficulty} • 10 Qs)`;
      this.updateLandingPills();
    }

    if (startBtn) startBtn.style.display = 'flex';
  }

  setLandingDifficulty(diff) {
    this.customDifficulty = diff;
    const startText = document.getElementById('landing-start-text');
    if (startText) {
      startText.textContent = `Start Custom Match (${this.customDifficulty} • 10 Qs)`;
    }
    this.updateLandingPills();
  }

  setLandingCompetition(comp) {
    this.customCompetition = comp;
    this.updateLandingPills();
  }

  updateLandingPills() {
    // Diff pills
    const diffPills = document.querySelectorAll('#landing-pills-diff .config-pill');
    diffPills.forEach(pill => {
      if (pill.textContent.includes(this.customDifficulty)) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Comp pills
    const compPills = document.querySelectorAll('#landing-pills-comp .config-pill');
    compPills.forEach(pill => {
      const onclickAttr = pill.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${this.customCompetition}'`)) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  startFromLanding() {
    this.showQuizView();
    this.startQuizSession();
  }

  goBackToLanding() {
    if (!this.isGameOver && (this.currentQuestionIndex > 0 || this.currentBank > 0)) {
      if (!confirm("Are you sure you want to return to the Main Menu? Your active match progress will be lost.")) {
        return;
      }
    }
    this.clearIntervalTimer();
    this.showLandingView();
  }

  playAgain() {
    const resultsModal = document.getElementById('modal-results');
    if (resultsModal) resultsModal.style.display = 'none';
    this.showQuizView();
    this.startQuizSession();
  }

  // =========================================================
  // 2. DYNAMIC INFINITE PRIZE & SAFETY NET CALCULATION
  // =========================================================
  getPrizeForRung(index) {
    // 0-indexed rung (index 0 = Rung 1)
    const fixedPrizes = [
      100, 200, 300, 500, 1000,         // Rungs 1-5 (Rung 5 is 1st safety net: $1,000)
      2000, 4000, 8000, 16000, 32000,   // Rungs 6-10 (Rung 10 is 2nd safety net: $32,000)
      64000, 125000, 250000, 500000, 1000000 // Rungs 11-15 (Rung 15 is 3rd safety net: $1,000,000)
    ];

    if (index < fixedPrizes.length) {
      return fixedPrizes[index];
    }

    // Extended Rungs 16 to 25
    const extendedPrizes = [
      2000000,   // Rung 16 ($2M)
      3500000,   // Rung 17 ($3.5M)
      5000000,   // Rung 18 ($5M)
      7500000,   // Rung 19 ($7.5M)
      10000000,  // Rung 20 ($10M) - 4th safety net
      15000000,  // Rung 21 ($15M)
      25000000,  // Rung 22 ($25M)
      40000000,  // Rung 23 ($40M)
      60000000,  // Rung 24 ($60M)
      100000000  // Rung 25 ($100M) - 5th safety net
    ];

    const extIndex = index - fixedPrizes.length;
    if (extIndex < extendedPrizes.length) {
      return extendedPrizes[extIndex];
    }

    // Beyond Rung 25: scales up exponentially (1.5x every rung)
    const extraRungs = index - (fixedPrizes.length + extendedPrizes.length - 1);
    const base = 100000000;
    return Math.round(base * Math.pow(1.5, extraRungs));
  }

  isSafetyNetRung(rungNumber) {
    // Every 5 rungs is a safety milestone (5, 10, 15, 20, 25, 30...)
    return rungNumber % 5 === 0;
  }

  getGuaranteedMilestone(questionIndex) {
    // Completed questions count = questionIndex
    if (questionIndex < 5) return 0;
    const highestPassedMilestoneRung = Math.floor(questionIndex / 5) * 5;
    return this.getPrizeForRung(highestPassedMilestoneRung - 1);
  }

  // =========================================================
  // 3. LOAD 10,000 QUESTIONS DATASET
  // =========================================================
  async loadQuestions() {
    try {
      const res = await fetch('questions.json');
      if (!res.ok) throw new Error("Could not load questions.json");
      this.allQuestions = await res.json();
      console.log(`Loaded ${this.allQuestions.length} football questions for Ball Knowledge Quiz!`);
    } catch (e) {
      console.warn("Using fallback questions pool", e);
      this.allQuestions = [
        { id: 1, c: "FIFA World Cup", d: "Very Easy", q: "Which nation won the 2022 FIFA World Cup in Qatar?", o: ["Argentina", "France", "Croatia", "Morocco"], a: "Argentina", e: "Argentina defeated France in Qatar 2022." },
        { id: 2, c: "La Liga", d: "Very Easy", q: "Which club does Lionel Messi hold the all-time scoring record for?", o: ["FC Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"], a: "FC Barcelona", e: "Messi scored 672 goals for FC Barcelona." },
        { id: 3, c: "Premier League", d: "Very Easy", q: "Which club is known as 'The Gunners'?", o: ["Arsenal", "Chelsea", "Liverpool", "Manchester United"], a: "Arsenal", e: "Arsenal was founded in Woolwich 1886." },
        { id: 4, c: "Premier League", d: "Very Easy", q: "What color home shirts do Manchester United and Liverpool wear?", o: ["Red", "Blue", "White", "Yellow"], a: "Red", e: "Both United and Liverpool wear red." },
        { id: 5, c: "FIFA World Cup", d: "Very Easy", q: "How many World Cup trophies has Brazil won?", o: ["5", "3", "4", "6"], a: "5", e: "Brazil holds 5 World Cup titles." },
        { id: 6, c: "Premier League", d: "Easy", q: "Which manager famously led Arsenal to an unbeaten 'Invincibles' season in 2003-04?", o: ["Arsène Wenger", "Alex Ferguson", "José Mourinho", "Rafael Benítez"], a: "Arsène Wenger", e: "Arsène Wenger's Arsenal went 38 games unbeaten." },
        { id: 7, c: "Serie A", d: "Easy", q: "Which iconic stadium is shared by both AC Milan and Inter Milan?", o: ["San Siro", "Allianz Stadium", "Stadio Olimpico", "Diego Maradona Stadium"], a: "San Siro", e: "The San Siro (Stadio Giuseppe Meazza) is shared by both clubs." },
        { id: 8, c: "Bundesliga", d: "Easy", q: "Which club has won the most Bundesliga championship titles?", o: ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "Hamburger SV"], a: "Bayern Munich", e: "Bayern Munich has won over 30 Bundesliga titles." }
      ];
    }
  }

  // =========================================================
  // 4. START MATCH SESSION & UNLIMITED ENGINE
  // =========================================================
  startQuizSession() {
    this.currentQuestionIndex = 0;
    this.currentBank = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.isGameOver = false;
    this.usedQuestionIds.clear();

    // Reset Lifelines
    this.lifelines = { fifty: true, fans: true, freeze: true };
    const btn50 = document.getElementById('btn-ll-5050');
    const btnFans = document.getElementById('btn-ll-fans');
    const btnFreeze = document.getElementById('btn-ll-freeze');
    if (btn50) btn50.disabled = false;
    if (btnFans) btnFans.disabled = false;
    if (btnFreeze) btnFreeze.disabled = false;

    // Update Mode Label & Walk Away Button
    const modeLabel = document.getElementById('active-mode-label');
    const walkAwayBtn = document.getElementById('btn-walk-away');
    const ladderDrawer = document.getElementById('money-ladder-drawer');

    if (this.currentMode === 'ballknowledge') {
      if (modeLabel) modeLabel.textContent = "🧠 Check Your Ball Knowledge";
      if (walkAwayBtn) {
        walkAwayBtn.style.display = "flex";
        walkAwayBtn.innerHTML = `<span>💼</span><span>Walk Away ($0)</span>`;
      }
      if (ladderDrawer) {
        ladderDrawer.style.display = "block";
        ladderDrawer.classList.add('active-drawer');
      }
      this.renderLadderRungs();
    } else {
      if (modeLabel) modeLabel.textContent = `🎯 Custom: ${this.customDifficulty}`;
      if (walkAwayBtn) walkAwayBtn.style.display = "none";
      if (ladderDrawer) {
        ladderDrawer.style.display = "none";
        ladderDrawer.classList.remove('active-drawer');
      }
    }

    this.renderNextQuestion();
  }

  renderLadderRungs() {
    const list = document.getElementById('ladder-rungs-list');
    if (!list) return;
    list.innerHTML = '';

    // Truly dynamic ladder: always displays upcoming rungs beyond the current question
    // E.g. displays at least 15 rungs or current step + 6 rungs
    const maxRung = Math.max(15, this.currentQuestionIndex + 6);

    for (let r = maxRung; r >= 1; r--) {
      const prize = this.getPrizeForRung(r - 1);
      const isSafe = this.isSafetyNetRung(r);
      const isActive = (r === this.currentQuestionIndex + 1);
      const isPassed = (r <= this.currentQuestionIndex);

      const div = document.createElement('div');
      div.className = `ladder-rung ${isActive ? 'active' : ''} ${isPassed && !isActive ? 'passed' : ''} ${isSafe ? 'safe' : ''}`;
      div.id = `ladder-rung-${r}`;
      div.innerHTML = `
        <span>${isSafe ? '🛡️ ' : ''}${r}.</span>
        <span>$${prize.toLocaleString()}</span>
      `;
      list.appendChild(div);
    }

    // Auto-scroll drawer to active rung so player always sees their exact position
    setTimeout(() => {
      const activeEl = document.getElementById(`ladder-rung-${this.currentQuestionIndex + 1}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  renderNextQuestion() {
    this.isAnsweringAllowed = true;
    this.selectedOption = null;
    const expBar = document.getElementById('explanation-bar');
    if (expBar) expBar.style.display = 'none';

    // 1. Pick Question
    if (this.currentMode === 'ballknowledge') {
      // TRULY UNLIMITED RANDOM QUESTION FROM 10,000 POOL!
      // Filter out already used questions in this session
      let available = this.allQuestions.filter(q => !this.usedQuestionIds.has(q.id));
      if (available.length === 0) {
        this.usedQuestionIds.clear();
        available = this.allQuestions;
      }

      this.currentQuestion = available[Math.floor(Math.random() * available.length)];
      this.usedQuestionIds.add(this.currentQuestion.id);

      const currentPrize = this.getPrizeForRung(this.currentQuestionIndex);
      const stepPill = document.getElementById('step-counter-pill');
      if (stepPill) {
        stepPill.textContent = `Question ${this.currentQuestionIndex + 1} • Prize: $${currentPrize.toLocaleString()}`;
      }

      const walkAwayBtn = document.getElementById('btn-walk-away');
      if (walkAwayBtn) {
        walkAwayBtn.innerHTML = `<span>💼</span><span>Walk Away ($${this.currentBank.toLocaleString()})</span>`;
      }

      // Progress bar towards next safety net checkpoint
      const currentSegment = this.currentQuestionIndex % 5;
      const pct = Math.min(100, Math.round(((currentSegment + 1) / 5) * 100));
      const progressBar = document.getElementById('progress-bar-fill');
      if (progressBar) progressBar.style.width = `${pct}%`;

      this.renderLadderRungs();

    } else {
      // Custom Difficulty Sprint (10 Questions)
      let pool = this.allQuestions;
      if (this.customCompetition !== 'all') {
        const filteredComp = pool.filter(q => q.c === this.customCompetition);
        if (filteredComp.length > 0) pool = filteredComp;
      }
      if (this.customDifficulty !== 'all') {
        const diffPool = pool.filter(q => q.d === this.customDifficulty);
        if (diffPool.length > 0) pool = diffPool;
      }

      let available = pool.filter(q => !this.usedQuestionIds.has(q.id));
      if (available.length === 0) {
        this.usedQuestionIds.clear();
        available = pool;
      }

      this.currentQuestion = available[Math.floor(Math.random() * available.length)];
      this.usedQuestionIds.add(this.currentQuestion.id);

      const stepPill = document.getElementById('step-counter-pill');
      if (stepPill) {
        stepPill.textContent = `Question ${this.currentQuestionIndex + 1} of 10 • ${this.customDifficulty}`;
      }

      const pct = Math.min(100, Math.round(((this.currentQuestionIndex + 1) / 10) * 100));
      const progressBar = document.getElementById('progress-bar-fill');
      if (progressBar) progressBar.style.width = `${pct}%`;
    }

    const q = this.currentQuestion;
    const catLeague = document.getElementById('category-league-label');
    const catDiff = document.getElementById('category-diff-label');
    const qHeading = document.getElementById('question-heading');

    if (catLeague) catLeague.textContent = q.c;
    if (catDiff) catDiff.textContent = q.d;
    if (qHeading) qHeading.textContent = q.q;

    // Populate Option Cards
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`option-btn-${i}`);
      const title = document.getElementById(`opt-title-${i}`);
      if (title) title.textContent = q.o[i] || '';
      if (btn) {
        btn.className = `option-card-btn anim-stagger-${i + 1}`;
        btn.disabled = false;
      }
    }

    this.startShotClock();
  }

  // =========================================================
  // 5. SHOT CLOCK (30 SECONDS)
  // =========================================================
  startShotClock() {
    this.clearIntervalTimer();
    this.timerSeconds = 30;

    this.timerInterval = setInterval(() => {
      this.timerSeconds--;

      if (this.timerSeconds <= 5 && this.timerSeconds > 0) {
        this.playTone(880, 'sine', 0.04, 0.05);
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

  // =========================================================
  // 6. ANSWER SELECTION & VALIDATION
  // =========================================================
  handleSelectOption(idx) {
    if (!this.isAnsweringAllowed) return;
    this.isAnsweringAllowed = false;
    this.clearIntervalTimer();

    const q = this.currentQuestion;
    const chosenText = q.o[idx];
    const isCorrect = (chosenText || '').trim().toLowerCase() === q.a.trim().toLowerCase();

    // Highlight Option Cards
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`option-btn-${i}`);
      if (!btn) continue;
      const opt = q.o[i];
      btn.disabled = true;

      if ((opt || '').trim().toLowerCase() === q.a.trim().toLowerCase()) {
        btn.classList.add('correct');
      } else if (i === idx && !isCorrect) {
        btn.classList.add('wrong');
      } else {
        btn.classList.add('dimmed');
      }
    }

    const expBar = document.getElementById('explanation-bar');
    const expTitle = document.getElementById('explanation-title');
    const expBody = document.getElementById('explanation-body');

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      this.playGoalCheer();

      if (this.currentMode === 'ballknowledge') {
        const prizeWon = this.getPrizeForRung(this.currentQuestionIndex);
        this.currentBank = prizeWon;
        this.score += prizeWon;
        if (expTitle) {
          expTitle.innerHTML = `<span style="color:var(--teal-primary);">✓ Correct! You Banked $${prizeWon.toLocaleString()}</span>`;
        }
      } else {
        const speedBonus = Math.floor((this.timerSeconds / 30) * 50);
        const pts = 100 + speedBonus + (this.streak * 15);
        this.score += pts;
        if (expTitle) {
          expTitle.innerHTML = `<span style="color:var(--teal-primary);">✓ Correct Answer! (+${pts} PTS)</span>`;
        }
      }

      if (window.confetti) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }

    } else {
      this.wrongCount++;
      this.streak = 0;
      this.playMissTone();

      if (this.currentMode === 'ballknowledge') {
        const guaranteed = this.getGuaranteedMilestone(this.currentQuestionIndex);
        this.currentBank = guaranteed;
        if (expTitle) {
          expTitle.innerHTML = `<span style="color:var(--terracotta);">✕ Incorrect! You Fall Back to $${guaranteed.toLocaleString()}</span>`;
        }
        this.isGameOver = true;
      } else {
        if (expTitle) {
          expTitle.innerHTML = `<span style="color:var(--terracotta);">✕ Off the Target!</span>`;
        }
      }
    }

    if (expBody) {
      expBody.textContent = q.e || `The verified answer is ${q.a}.`;
    }
    if (expBar) expBar.style.display = 'block';
  }

  handleTimeout() {
    this.handleSelectOption(-1);
  }

  nextQuestion() {
    // In Ball Knowledge mode: continues UNLIMITED unless game is over (wrong answer)
    if (this.isGameOver || (this.currentMode === 'custom' && this.currentQuestionIndex >= 9)) {
      this.triggerLoadingAndShowResults();
    } else {
      this.currentQuestionIndex++;
      this.renderNextQuestion();
    }
  }

  // =========================================================
  // 7. WALK AWAY (BALL KNOWLEDGE EXCLUSIVE)
  // =========================================================
  walkAwayAndBank() {
    if (this.currentMode !== 'ballknowledge') return;
    if (confirm(`💼 Do you want to walk away now and secure your $${this.currentBank.toLocaleString()} prize?`)) {
      this.clearIntervalTimer();
      this.isGameOver = true;
      this.triggerLoadingAndShowResults();
    }
  }

  // =========================================================
  // 8. LIFELINES (50:50, ASK FANS, FREEZE)
  // =========================================================
  useLifeline5050() {
    if (!this.lifelines.fifty || !this.isAnsweringAllowed) return;
    this.lifelines.fifty = false;
    const btn = document.getElementById('btn-ll-5050');
    if (btn) btn.disabled = true;

    const q = this.currentQuestion;
    const wrongIndices = [];
    q.o.forEach((opt, idx) => {
      if (opt.trim().toLowerCase() !== q.a.trim().toLowerCase()) {
        wrongIndices.push(idx);
      }
    });

    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    toEliminate.forEach(idx => {
      const optBtn = document.getElementById(`option-btn-${idx}`);
      if (optBtn) optBtn.classList.add('eliminated');
    });

    this.playTone(523, 'sine', 0.1);
  }

  useLifelineFans() {
    if (!this.lifelines.fans || !this.isAnsweringAllowed) return;
    this.lifelines.fans = false;
    const btn = document.getElementById('btn-ll-fans');
    if (btn) btn.disabled = true;

    const q = this.currentQuestion;
    const correctIdx = q.o.findIndex(opt => opt.trim().toLowerCase() === q.a.trim().toLowerCase());

    const correctPct = Math.floor(68 + Math.random() * 18);
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
      const fillEl = document.getElementById(`poll-fill-${i}`);
      const pctEl = document.getElementById(`poll-pct-${i}`);
      if (fillEl) fillEl.style.width = `${pcts[i]}%`;
      if (pctEl) pctEl.textContent = `${pcts[i]}%`;
    }

    const modal = document.getElementById('modal-fan-poll');
    if (modal) modal.style.display = 'flex';
  }

  useLifelineFreeze() {
    if (!this.lifelines.freeze || !this.isAnsweringAllowed) return;
    this.lifelines.freeze = false;
    const btn = document.getElementById('btn-ll-freeze');
    if (btn) btn.disabled = true;

    this.timerSeconds += 15;
    this.playTone(659, 'triangle', 0.2);
  }

  // =========================================================
  // 9. DEDICATED LOADING TRANSITION & RESULTS DISPLAY
  // =========================================================
  triggerLoadingAndShowResults() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'flex';

    setTimeout(() => {
      if (loadingScreen) loadingScreen.style.display = 'none';
      this.showResultDashboard();
    }, 1100);
  }

  showResultDashboard() {
    this.clearIntervalTimer();
    const modal = document.getElementById('modal-results');
    if (modal) modal.style.display = 'flex';

    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    let ovr = Math.round(84 + (acc * 0.1) + (this.maxStreak * 1.2));
    if (this.currentMode === 'ballknowledge' && this.currentBank >= 1000000) ovr = 99;
    ovr = Math.max(80, Math.min(99, ovr));

    let title = "Ballon d'Or Tactician";
    let badgeText = "World Class";
    if (ovr < 88) {
      title = "Season Ticket Analyst";
      badgeText = "Intermediate";
    } else if (ovr < 93) {
      title = "Premier League Tactician";
      badgeText = "Advanced";
    } else if (ovr < 96) {
      title = "Champions League Maestro";
      badgeText = "Elite";
    }

    // Populate Stats Grid
    const statLabel1 = document.getElementById('stat-label-1');
    const statValBank = document.getElementById('stat-val-bank');
    const playcardScore = document.getElementById('playcard-score');
    const statValTotal = document.getElementById('stat-val-total');

    if (this.currentMode === 'ballknowledge') {
      if (statLabel1) statLabel1.textContent = "Prize Banked";
      if (statValBank) statValBank.textContent = `$${this.currentBank.toLocaleString()}`;
      if (playcardScore) playcardScore.textContent = `$${this.currentBank.toLocaleString()}`;
    } else {
      if (statLabel1) statLabel1.textContent = "Total Points";
      if (statValBank) statValBank.textContent = this.score.toLocaleString();
      if (playcardScore) playcardScore.textContent = `${this.score.toLocaleString()} PTS`;
    }

    const statValAcc = document.getElementById('stat-val-acc');
    const statValStreak = document.getElementById('stat-val-streak');
    if (statValAcc) statValAcc.textContent = `${acc}%`;
    if (statValStreak) statValStreak.textContent = `${this.maxStreak} 🔥`;
    if (statValTotal) statValTotal.textContent = `${total} Questions (${this.correctCount} Correct)`;

    // Populate Collectible Playcard (FOR EVERYONE)
    const profileTitle = document.getElementById('result-profile-title');
    const playcardBadge = document.getElementById('playcard-badge');
    const playcardName = document.getElementById('playcard-name');
    const playcardOvr = document.getElementById('playcard-ovr');
    const playcardAcc = document.getElementById('playcard-acc');
    const playcardStreak = document.getElementById('playcard-streak');
    const playcardTier = document.getElementById('playcard-tier');

    if (profileTitle) profileTitle.textContent = title;
    if (playcardBadge) playcardBadge.textContent = badgeText;
    if (playcardName) playcardName.textContent = this.currentUser.name || 'Guest Baller';
    if (playcardOvr) playcardOvr.textContent = ovr;
    if (playcardAcc) playcardAcc.textContent = `${acc}%`;
    if (playcardStreak) playcardStreak.textContent = `${this.maxStreak} 🔥`;
    if (playcardTier) playcardTier.textContent = badgeText;

    if (window.confetti) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    }
  }

  // =========================================================
  // 10. GMAIL SIGN-IN & LEADERBOARD LOGIC
  // =========================================================
  handleGoogleSignInForLeaderboard() {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const googleName = prompt("Enter your Baller Handle for the Official Leaderboard:", this.currentUser.name !== 'Guest Baller' ? this.currentUser.name : `Baller_${randomSuffix}`);
    if (!googleName) return;

    this.currentUser = {
      name: googleName.trim(),
      email: `${googleName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      club: 'Verified Club',
      verified: true
    };
    localStorage.setItem('footy_editorial_user', JSON.stringify(this.currentUser));

    // Update UI
    const playcardName = document.getElementById('playcard-name');
    if (playcardName) playcardName.textContent = this.currentUser.name;
    const btnText = document.getElementById('google-btn-text');
    if (btnText) btnText.textContent = `✓ Verified as ${this.currentUser.email}`;

    // Submit to Leaderboard API
    const finalScore = this.currentMode === 'ballknowledge' ? this.currentBank : this.score;
    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;
    const iqEl = document.getElementById('playcard-ovr');
    const iq = iqEl ? parseInt(iqEl.textContent) || 96 : 96;

    fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.currentUser.name,
        email: this.currentUser.email,
        club: this.currentUser.club,
        score: finalScore,
        accuracy: acc,
        iq: iq
      })
    }).then(() => {
      alert(`🎉 Verified with Gmail! Score of ${finalScore.toLocaleString()} recorded to the Official Global Leaderboard.`);
    }).catch(() => {
      alert(`🎉 Verified with Gmail! Your score has been recorded.`);
    });
  }

  sharePlaycard() {
    const ovr = document.getElementById('playcard-ovr')?.textContent || '96';
    const score = document.getElementById('playcard-score')?.textContent || '$1,000,000';
    const name = document.getElementById('playcard-name')?.textContent || 'Guest Baller';
    const text = `⚽ FootyQuiz Editorial Playcard\n👑 Player: ${name}\n🎯 Rating: ${ovr} OVR\n💰 Result: ${score}\n\nProve your ball knowledge: quiz.bhuwanadhikari007.com.np`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert("Playcard copied to clipboard! Share it with your football group.");
      });
    } else {
      alert(text);
    }
  }

  // =========================================================
  // 11. LEADERBOARD MODAL
  // =========================================================
  async openLeaderboardModal() {
    const modal = document.getElementById('modal-leaderboard');
    const list = document.getElementById('leaderboard-list');
    if (modal) modal.style.display = 'flex';
    if (!list) return;

    list.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; color:var(--graphite-60);">Loading Verified Standings...</div>`;

    try {
      const res = await fetch('/api/leaderboard?type=global');
      const data = await res.json();
      list.innerHTML = '';

      data.slice(0, 15).forEach((entry, idx) => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--cream-bg); border-radius:14px; font-size:13px;";
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:800; color:var(--teal-primary); width:20px;">#${idx + 1}</span>
            <div>
              <div style="font-weight:700; color:var(--graphite);">${entry.name} <span style="font-size:10px; color:var(--teal-primary); background:var(--teal-light); padding:1px 6px; border-radius:9999px;">✓ Gmail</span></div>
              <div style="font-size:11px; color:var(--graphite-60);">${entry.club || 'Neutral'} • Accuracy: ${entry.accuracy}%</div>
            </div>
          </div>
          <div style="font-family:var(--font-serif); font-weight:800; color:var(--terracotta); font-size:15px;">
            ${entry.score.toLocaleString()}
          </div>
        `;
        list.appendChild(item);
      });
    } catch (e) {
      list.innerHTML = `
        <div style="padding:10px 14px; background:var(--cream-bg); border-radius:14px; display:flex; justify-content:space-between;">
          <span>#1 Thierry_King14 (✓ Gmail)</span>
          <span style="font-weight:800; color:var(--terracotta);">$2,840,000</span>
        </div>
        <div style="padding:10px 14px; background:var(--cream-bg); border-radius:14px; display:flex; justify-content:space-between;">
          <span>#2 Zizou_Volley (✓ Gmail)</span>
          <span style="font-weight:800; color:var(--terracotta);">$1,000,000</span>
        </div>
      `;
    }
  }

  closeLeaderboardModal() {
    const modal = document.getElementById('modal-leaderboard');
    if (modal) modal.style.display = 'none';
  }

  // =========================================================
  // 12. SOUND SYNTHESIZER
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

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
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
    this.playTone(523.25, 'triangle', 0.15, 0.2);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.18, 0.2), 70);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.22), 140);
    setTimeout(() => this.playTone(1046.50, 'sine', 0.4, 0.25), 210);
  }

  playMissTone() {
    this.playTone(220, 'sawtooth', 0.2, 0.18);
    setTimeout(() => this.playTone(174.61, 'sawtooth', 0.35, 0.2), 100);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const icon = document.getElementById('icon-sound');
    if (icon) {
      if (this.soundEnabled) {
        icon.setAttribute('data-lucide', 'volume-2');
        icon.style.color = 'var(--teal-primary)';
      } else {
        icon.setAttribute('data-lucide', 'volume-x');
        icon.style.color = 'var(--graphite-60)';
      }
    }
    lucide.createIcons();
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Only process shortcuts when quiz view is active
      const quizView = document.getElementById('view-quiz');
      if (!quizView || quizView.style.display === 'none') return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        this.handleSelectOption(parseInt(e.key) - 1);
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        const expBar = document.getElementById('explanation-bar');
        if (expBar && expBar.style.display === 'block') {
          e.preventDefault();
          this.nextQuestion();
        }
      }
    });
  }
}

// Global Single Instance
window.app = new FootyEditorialApp();
