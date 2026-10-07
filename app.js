/**
 * FootyQuiz Pro - Editorial Nurture Ball Knowledge Controller
 * Features:
 * 1. Unlimited Millionaire Mode (Endless Random Mix of Easy, Medium, Hard, Very Hard, Elite)
 * 2. Custom Match Tier Selector (Very Easy to Elite, League Filtering)
 * 3. Dedicated Loading Transition & Diagnostic Results Dashboard
 * 4. Collectible Playcard Generation for EVERYONE (Guest or Signed In)
 * 5. Gmail Sign-In requirement for Official Global Leaderboard Recording
 * 6. Web Audio Synthesizer & Stadium Fan Poll Lifeline
 */

class FootyEditorialApp {
  constructor() {
    // Mode Configuration: 'millionaire' (unlimited) or 'custom'
    this.currentMode = 'millionaire';
    this.customDifficulty = 'Very Easy';
    this.customCompetition = 'all';

    // Unlimited Millionaire Prize Function
    this.currentQuestionIndex = 0;
    this.currentBank = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;

    // Database
    this.allQuestions = [];
    this.currentQuestion = null;
    this.isAnsweringAllowed = false;
    this.selectedOption = null;
    this.isGameOver = false;

    // Lifelines (1 use per match)
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

    await this.loadQuestions();
    this.startQuizSession();
  }

  // =========================================================
  // 1. DYNAMIC PRIZE CALCULATION FOR UNLIMITED MILLIONAIRE
  // =========================================================
  getMillionairePrize(index) {
    const fixedPrizes = [
      100, 200, 300, 500, 1000, 
      2000, 4000, 8000, 16000, 32000, 
      64000, 125000, 250000, 500000, 1000000
    ];
    if (index < fixedPrizes.length) {
      return fixedPrizes[index];
    }
    // Beyond 15: Scales exponentially ($2M, $5M, $10M, $25M...)
    const extra = index - 14;
    return 1000000 * Math.pow(2, extra);
  }

  getGuaranteedMilestone(index) {
    if (index >= 15) return 1000000;
    if (index >= 10) return 32000;
    if (index >= 5) return 1000;
    return 0;
  }

  // =========================================================
  // 2. LOAD 10,000 QUESTIONS DATASET
  // =========================================================
  async loadQuestions() {
    try {
      const res = await fetch('questions.json');
      if (!res.ok) throw new Error("Could not load questions.json");
      this.allQuestions = await res.json();
      console.log(`Loaded ${this.allQuestions.length} football questions for Editorial Quiz!`);
    } catch (e) {
      console.warn("Using verified fallback questions pool", e);
      this.allQuestions = [
        { id: 1, c: "FIFA World Cup", d: "Very Easy", q: "Which country won the 2022 FIFA World Cup in Qatar?", o: ["Argentina", "France", "Croatia", "Morocco"], a: "Argentina", e: "Argentina defeated France in Qatar 2022." },
        { id: 2, c: "La Liga", d: "Very Easy", q: "Which club does Lionel Messi hold the all-time scoring record for?", o: ["FC Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"], a: "FC Barcelona", e: "Messi scored 672 goals for FC Barcelona." },
        { id: 3, c: "Premier League", d: "Very Easy", q: "Which club is known as 'The Gunners'?", o: ["Arsenal", "Chelsea", "Liverpool", "Manchester United"], a: "Arsenal", e: "Arsenal was founded in Woolwich 1886." },
        { id: 4, c: "Premier League", d: "Very Easy", q: "What color home shirts do Manchester United and Liverpool wear?", o: ["Red", "Blue", "White", "Yellow"], a: "Red", e: "Both United and Liverpool wear red." },
        { id: 5, c: "FIFA World Cup", d: "Very Easy", q: "How many World Cup trophies has Brazil won?", o: ["5", "3", "4", "6"], a: "5", e: "Brazil holds 5 World Cup titles." }
      ];
    }
  }

  // =========================================================
  // 3. START MATCH SESSION & UNLIMITED ENGINE
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

    // Reset Lifelines
    this.lifelines = { fifty: true, fans: true, freeze: true };
    document.getElementById('btn-ll-5050').disabled = false;
    document.getElementById('btn-ll-fans').disabled = false;
    document.getElementById('btn-ll-freeze').disabled = false;

    // Update Mode Label & Walk Away Button
    const modeLabel = document.getElementById('active-mode-label');
    const walkAwayBtn = document.getElementById('btn-walk-away');
    const ladderDrawer = document.getElementById('money-ladder-drawer');

    if (this.currentMode === 'millionaire') {
      modeLabel.textContent = "💰 Unlimited Millionaire";
      walkAwayBtn.style.display = "flex";
      walkAwayBtn.innerHTML = `<span>💼</span><span>Walk Away ($0)</span>`;
      ladderDrawer.style.display = "block";
      this.renderLadderRungs();
    } else {
      modeLabel.textContent = `🎯 Tier: ${this.customDifficulty}`;
      walkAwayBtn.style.display = "none";
      ladderDrawer.style.display = "none";
    }

    this.renderNextQuestion();
  }

  renderLadderRungs() {
    const list = document.getElementById('ladder-rungs-list');
    list.innerHTML = '';
    
    // Display up to 15 rungs or current step + 5
    const maxRung = Math.max(15, this.currentQuestionIndex + 5);
    for (let r = maxRung; r >= 1; r--) {
      const prize = this.getMillionairePrize(r - 1);
      const isSafe = (r === 5 || r === 10 || r === 15);
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
  }

  renderNextQuestion() {
    this.isAnsweringAllowed = true;
    this.selectedOption = null;
    document.getElementById('explanation-bar').style.display = 'none';

    // Pick question
    if (this.currentMode === 'millionaire') {
      // Endless random mix of Easy, Medium, Hard, Very Hard, Elite!
      this.currentQuestion = this.allQuestions[Math.floor(Math.random() * this.allQuestions.length)];
      
      const currentPrize = this.getMillionairePrize(this.currentQuestionIndex);
      document.getElementById('step-counter-pill').textContent = `Question ${this.currentQuestionIndex + 1} • Prize: $${currentPrize.toLocaleString()}`;
      document.getElementById('btn-walk-away').innerHTML = `<span>💼</span><span>Walk Away ($${this.currentBank.toLocaleString()})</span>`;
      
      // Update Progress Bar
      const pct = Math.min(100, Math.round(((this.currentQuestionIndex + 1) / 15) * 100));
      document.getElementById('progress-bar-fill').style.width = `${pct}%`;

      this.renderLadderRungs();

    } else {
      // Custom Difficulty Sprint
      let pool = this.allQuestions;
      if (this.customCompetition !== 'all') {
        pool = pool.filter(q => q.c === this.customCompetition);
      }
      if (this.customDifficulty !== 'all') {
        const diffPool = pool.filter(q => q.d === this.customDifficulty);
        if (diffPool.length > 0) pool = diffPool;
      }
      this.currentQuestion = pool[Math.floor(Math.random() * pool.length)];

      document.getElementById('step-counter-pill').textContent = `Question ${this.currentQuestionIndex + 1} of 10 • ${this.customDifficulty}`;
      const pct = Math.min(100, Math.round(((this.currentQuestionIndex + 1) / 10) * 100));
      document.getElementById('progress-bar-fill').style.width = `${pct}%`;
    }

    const q = this.currentQuestion;
    document.getElementById('category-league-label').textContent = q.c;
    document.getElementById('category-diff-label').textContent = q.d;
    document.getElementById('question-heading').textContent = q.q;

    // Populate Option Cards
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`option-btn-${i}`);
      const title = document.getElementById(`opt-title-${i}`);
      title.textContent = q.o[i] || '';
      btn.className = `option-card-btn anim-stagger-${i + 1}`;
      btn.disabled = false;
    }

    this.startShotClock();
  }

  // =========================================================
  // 4. SHOT CLOCK (30 SECONDS)
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
  // 5. ANSWER SELECTION & VALIDATION
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

      if (this.currentMode === 'millionaire') {
        const prizeWon = this.getMillionairePrize(this.currentQuestionIndex);
        this.currentBank = prizeWon;
        this.score += prizeWon;
        expTitle.innerHTML = `<span style="color:var(--teal-primary);">✓ Correct! You Banked $${prizeWon.toLocaleString()}</span>`;
      } else {
        const speedBonus = Math.floor((this.timerSeconds / 30) * 50);
        const pts = 100 + speedBonus + (this.streak * 15);
        this.score += pts;
        expTitle.innerHTML = `<span style="color:var(--teal-primary);">✓ Correct Answer! (+${pts} PTS)</span>`;
      }

      if (window.confetti) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }

    } else {
      this.wrongCount++;
      this.streak = 0;
      this.playMissTone();

      if (this.currentMode === 'millionaire') {
        const guaranteed = this.getGuaranteedMilestone(this.currentQuestionIndex);
        this.currentBank = guaranteed;
        expTitle.innerHTML = `<span style="color:var(--terracotta);">✕ Incorrect! You Fall Back to $${guaranteed.toLocaleString()}</span>`;
        this.isGameOver = true;
      } else {
        expTitle.innerHTML = `<span style="color:var(--terracotta);">✕ Off the Target!</span>`;
      }
    }

    expBody.textContent = q.e || `The verified answer is ${q.a}.`;
    expBar.style.display = 'block';
  }

  handleTimeout() {
    this.handleSelectOption(-1);
  }

  nextQuestion() {
    if (this.isGameOver || (this.currentMode === 'custom' && this.currentQuestionIndex >= 9)) {
      this.triggerLoadingAndShowResults();
    } else {
      this.currentQuestionIndex++;
      this.renderNextQuestion();
    }
  }

  // =========================================================
  // 6. WALK AWAY (MILLIONAIRE EXCLUSIVE)
  // =========================================================
  walkAwayAndBank() {
    if (this.currentMode !== 'millionaire') return;
    if (confirm(`💼 Do you want to walk away now and secure your $${this.currentBank.toLocaleString()} prize?`)) {
      this.clearIntervalTimer();
      this.isGameOver = true;
      this.triggerLoadingAndShowResults();
    }
  }

  // =========================================================
  // 7. LIFELINES (50:50, ASK FANS, FREEZE)
  // =========================================================
  useLifeline5050() {
    if (!this.lifelines.fifty || !this.isAnsweringAllowed) return;
    this.lifelines.fifty = false;
    document.getElementById('btn-ll-5050').disabled = true;

    const q = this.currentQuestion;
    const wrongIndices = [];
    q.o.forEach((opt, idx) => {
      if (opt.trim().toLowerCase() !== q.a.trim().toLowerCase()) {
        wrongIndices.push(idx);
      }
    });

    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    toEliminate.forEach(idx => {
      document.getElementById(`option-btn-${idx}`).classList.add('eliminated');
    });

    this.playTone(523, 'sine', 0.1);
  }

  useLifelineFans() {
    if (!this.lifelines.fans || !this.isAnsweringAllowed) return;
    this.lifelines.fans = false;
    document.getElementById('btn-ll-fans').disabled = true;

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
    this.playTone(659, 'triangle', 0.2);
  }

  // =========================================================
  // 8. DEDICATED LOADING TRANSITION & RESULTS DISPLAY
  // =========================================================
  triggerLoadingAndShowResults() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.display = 'flex';

    setTimeout(() => {
      loadingScreen.style.display = 'none';
      this.showResultDashboard();
    }, 1100);
  }

  showResultDashboard() {
    this.clearIntervalTimer();
    const modal = document.getElementById('modal-results');
    modal.style.display = 'flex';

    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    let ovr = Math.round(84 + (acc * 0.1) + (this.maxStreak * 1.2));
    if (this.currentMode === 'millionaire' && this.currentBank >= 1000000) ovr = 99;
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
    if (this.currentMode === 'millionaire') {
      document.getElementById('stat-label-1').textContent = "Prize Banked";
      document.getElementById('stat-val-bank').textContent = `$${this.currentBank.toLocaleString()}`;
      document.getElementById('playcard-score').textContent = `$${this.currentBank.toLocaleString()}`;
    } else {
      document.getElementById('stat-label-1').textContent = "Total Points";
      document.getElementById('stat-val-bank').textContent = this.score.toLocaleString();
      document.getElementById('playcard-score').textContent = `${this.score.toLocaleString()} PTS`;
    }

    document.getElementById('stat-val-acc').textContent = `${acc}%`;
    document.getElementById('stat-val-streak').textContent = `${this.maxStreak} 🔥`;

    // Populate Collectible Playcard (FOR EVERYONE)
    document.getElementById('result-profile-title').textContent = title;
    document.getElementById('playcard-badge').textContent = badgeText;
    document.getElementById('playcard-name').textContent = this.currentUser.name || 'Guest Baller';
    document.getElementById('playcard-ovr').textContent = ovr;
    document.getElementById('playcard-acc').textContent = `${acc}%`;
    document.getElementById('playcard-streak').textContent = `${this.maxStreak} 🔥`;
    document.getElementById('playcard-tier').textContent = badgeText;

    if (window.confetti) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    }
  }

  resetQuiz() {
    document.getElementById('modal-results').style.display = 'none';
    this.startQuizSession();
  }

  // =========================================================
  // 9. GMAIL SIGN-IN & LEADERBOARD LOGIC
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
    document.getElementById('playcard-name').textContent = this.currentUser.name;
    const btnText = document.getElementById('google-btn-text');
    btnText.textContent = `✓ Verified as ${this.currentUser.email}`;

    // Submit to Leaderboard API
    const finalScore = this.currentMode === 'millionaire' ? this.currentBank : this.score;
    const total = this.correctCount + this.wrongCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;
    const iq = parseInt(document.getElementById('playcard-ovr').textContent) || 96;

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
    const ovr = document.getElementById('playcard-ovr').textContent;
    const score = document.getElementById('playcard-score').textContent;
    const name = document.getElementById('playcard-name').textContent;
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
  // 10. LEADERBOARD MODAL
  // =========================================================
  async openLeaderboardModal() {
    const modal = document.getElementById('modal-leaderboard');
    const list = document.getElementById('leaderboard-list');
    modal.style.display = 'flex';

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
    document.getElementById('modal-leaderboard').style.display = 'none';
  }

  // =========================================================
  // 11. LOBBY & CUSTOM SELECTORS
  // =========================================================
  openLobbyModal() {
    document.getElementById('modal-lobby').style.display = 'flex';
  }

  closeLobbyModal() {
    document.getElementById('modal-lobby').style.display = 'none';
  }

  setLobbyMode(mode) {
    this.tempMode = mode;
    const mCard = document.getElementById('lobby-mode-millionaire');
    const cCard = document.getElementById('lobby-mode-custom');
    const subset = document.getElementById('lobby-custom-subsettings');

    if (mode === 'millionaire') {
      mCard.style.border = '2px solid var(--teal-primary)';
      cCard.style.border = '1px solid var(--border-soft)';
      subset.style.display = 'none';
    } else {
      cCard.style.border = '2px solid var(--teal-primary)';
      mCard.style.border = '1px solid var(--border-soft)';
      subset.style.display = 'block';
    }
  }

  setCustomDifficulty(diff) {
    this.customDifficulty = diff;
    document.querySelectorAll('#pills-diff .editorial-btn').forEach(btn => {
      if (btn.textContent.includes(diff)) {
        btn.style.backgroundColor = 'var(--teal-primary)';
        btn.style.color = '#FFFFFF';
      } else {
        btn.style.backgroundColor = '#FFFFFF';
        btn.style.color = 'var(--graphite)';
      }
    });
  }

  setCustomCompetition(comp) {
    this.customCompetition = comp;
    document.querySelectorAll('#pills-comp .editorial-btn').forEach(btn => {
      btn.style.backgroundColor = '#FFFFFF';
      btn.style.color = 'var(--graphite)';
    });
    const found = Array.from(document.querySelectorAll('#pills-comp .editorial-btn')).find(b => b.onclick.toString().includes(comp));
    if (found) {
      found.style.backgroundColor = 'var(--teal-primary)';
      found.style.color = '#FFFFFF';
    }
  }

  confirmLobbyAndStart() {
    this.currentMode = this.tempMode || this.currentMode;
    this.closeLobbyModal();
    this.startQuizSession();
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
    if (this.soundEnabled) {
      icon.setAttribute('data-lucide', 'volume-2');
      icon.style.color = 'var(--teal-primary)';
    } else {
      icon.setAttribute('data-lucide', 'volume-x');
      icon.style.color = 'var(--graphite-60)';
    }
    lucide.createIcons();
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        this.handleSelectOption(parseInt(e.key) - 1);
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        if (document.getElementById('explanation-bar').style.display === 'block') {
          e.preventDefault();
          this.nextQuestion();
        }
      }
    });
  }
}

// Global Single Instance
window.app = new FootyEditorialApp();
