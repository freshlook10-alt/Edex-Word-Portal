
/*
 EDEX HIT THE BOX — COMPLETE JAVASCRIPT

 Original Arabic word randomizer restored.

 5 letters: ا ب ت ث ج
 3-letter challenge
 Real words or all 125 combinations
 Live timer and prize results

 Uses existing:
 firebase-config.js
 wordPortal/live
 wordSettings/main
 wordStats/total
 wordHistory

 All new game settings and stats use
 the hb prefix so the Box Game is not reset.
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const isAdmin = document.body.dataset.hitPage === "admin";
  const FV = firebase.firestore.FieldValue;

  const liveRef = db.collection("wordPortal").doc("live");
  const settingsRef = db.collection("wordSettings").doc("main");
  const statsRef = db.collection("wordStats").doc("total");
  const historyRef = db.collection("wordHistory");

  const LETTERS = ["ا","ب","ت","ث","ج"];
  const WORD_RE = /^[ابتثج]{3}$/u;

  const DEFAULT_WORDS = [
    "باب","بات","تاب","تاج","جاب",
    "ثاب","جثا","ثبت","بثت","تبت",
    "جبت","جثث","تجب","تبث","تثب"
  ];

  let authorized = false;
  let busy = false;
  let statsReady = false;
  let historyReady = false;

  let timeDirty = false;
  let wordsDirty = false;
  let modeDirty = false;

  let live = {};
  let stats = {};
  let records = [];

  let settings = {
    hbDurationSec:90,
    hbMode:"words",
    hbWords:DEFAULT_WORDS
  };

  let unsubPrivate = [];

  // TIME FORMAT

  function formatTime(value) {
    const n = Math.max(0,Math.ceil(Number(value) || 0));

    return (
      String(Math.floor(n / 60)).padStart(2,"0") +
      ":" +
      String(n % 60).padStart(2,"0")
    );
  }

  // SUPPORT 00:20, 01:30 OR PLAIN 20

  function parseTime(raw) {
    const value = String(raw).trim();
    let seconds;

    if (/^\d{1,2}:[0-5]\d$/.test(value)) {
      const [m,s] = value.split(":").map(Number);
      seconds = m * 60 + s;
    } else if (/^\d{1,3}$/.test(value)) {
      seconds = Number(value);
    } else {
      throw Error(
        "Enter 00:20, 01:30, 02:30 or a number of seconds."
      );
    }

    if (
      !Number.isSafeInteger(seconds) ||
      seconds < 10 ||
      seconds > 900
    ) {
      throw Error("Timer must be from 00:10 to 15:00.");
    }

    return seconds;
  }

  function duration() {
    const n = Number(
      live.hbDurationSec ||
      settings.hbDurationSec ||
      90
    );

    return Number.isFinite(n) && n >= 10 ? n : 90;
  }

  function timeLeft() {
    if (
      live.hbStage !== "running" ||
      !live.hbStartedAt?.toMillis
    ) {
      return duration();
    }

    return Math.max(
      0,
      (
        live.hbStartedAt.toMillis() +
        duration() * 1000 -
        Date.now()
      ) / 1000
    );
  }

  function stage() {
    if (
      live.hbStage === "running" &&
      live.hbStartedAt?.toMillis &&
      timeLeft() <= 0
    ) {
      return "expired";
    }

    return live.hbStage || "idle";
  }

  function millis(value) {
    return value?.toMillis?.() || 0;
  }

  function message(text,bad=false) {
    const target = $("hitMessage");
    if (!target) return;

    target.textContent = text;
    target.style.color = bad ? "#ff9bad" : "#aaf1c9";
  }

  async function perform(work) {
    if (!authorized || busy) return;

    busy = true;
    render();

    try {
      await work();
    } catch (err) {
      console.error(err);
      message(
        err?.message || "Unable to save. Check Firebase permissions.",
        true
      );
    } finally {
      busy = false;
      render();
    }
  }

  // CREATE ALL 125 LETTER COMBINATIONS

  function allCombinations() {
    const result = [];

    for (const a of LETTERS) {
      for (const b of LETTERS) {
        for (const c of LETTERS) {
          result.push(a+b+c);
        }
      }
    }

    return result;
  }

  function validWords(input) {
    const words = [...new Set(
      String(input)
        .normalize("NFC")
        .split(/[\s,،؛;]+/u)
        .map(x => x.trim())
        .filter(Boolean)
    )];

    if (!words.length) {
      throw Error("The word bank cannot be empty.");
    }

    if (words.some(w => !WORD_RE.test(w))) {
      throw Error(
        "Use only 3-letter words made from ا ب ت ث ج."
      );
    }

    return words;
  }

  function getPool(data) {
    if (data.hbMode === "all") {
      return allCombinations();
    }

    const words = data.hbWords || DEFAULT_WORDS;

    return Array.isArray(words) && words.length
      ? validWords(words.join(" "))
      : [...DEFAULT_WORDS];
  }

  // NEW RANDOM WORD

  async function randomize() {
    await db.runTransaction(async tx => {
      const [liveSnap,settingSnap] = await Promise.all([
        tx.get(liveRef),
        tx.get(settingsRef)
      ]);

      const current = liveSnap.data() || {};
      const saved = settingSnap.data() || {};

      const currentStage = current.hbStage || "idle";

      if (currentStage === "running") {
        throw Error(
          "Finish or cancel the current round first."
        );
      }

      const pool = getPool(saved);

      const used = Array.isArray(current.hbUsedWords)
        ? current.hbUsedWords.filter(w => pool.includes(w))
        : [];

      let available = pool.filter(w => !used.includes(w));
      let newCycle = [...used];

      if (!available.length) {
        newCycle = [];
        available = pool.filter(w => w !== current.hbWord);
      }

      if (!available.length) {
        available = [...pool];
      }

      const word =
        available[Math.floor(Math.random() * available.length)];

      newCycle.push(word);

      const sec = Number(saved.hbDurationSec || 90);

      tx.set(liveRef,{
        hbStage:"ready",
        hbWord:word,
        hbDurationSec:sec,
        hbStartedAt:null,
        hbUsedWords:newCycle,
        hbRoundId:Number(current.hbRoundId || 0) + 1,
        hbLastOutcome:""
      },{merge:true});
    });

    message("New Arabic word generated. Start the timer.");
  }

  // START ROUND

  async function startRound() {
    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);
      const current = snap.data() || {};

      if (
        current.hbStage !== "ready" ||
        !current.hbWord
      ) {
        throw Error("Randomize a word before starting.");
      }

      tx.set(liveRef,{
        hbStage:"running",
        hbStartedAt:FV.serverTimestamp()
      },{merge:true});
    });

    message("Timer started. Hit the correct boxes!");
  }

  // FINISH ROUND

  async function finishRound(won) {
    const recordRef = historyRef.doc();

    await db.runTransaction(async tx => {
      const [liveSnap,statsSnap] = await Promise.all([
        tx.get(liveRef),
        tx.get(statsRef)
      ]);

      const current = liveSnap.data() || {};
      const currentStats = statsSnap.data() || {};

      if (
        current.hbStage !== "running" ||
        !current.hbStartedAt?.toMillis
      ) {
        throw Error("There is no active round.");
      }

      const sec = Number(current.hbDurationSec || 90);

      const elapsed = Math.max(
        0,
        (Date.now() - current.hbStartedAt.toMillis()) / 1000
      );

      if (won && elapsed >= sec) {
        throw Error(
          "Time has expired. Choose NOT WON."
        );
      }

      const total = currentStats.hbStockTotal;
      const given = Number(currentStats.hbChocolates || 0);

      if (
        won &&
        Number.isSafeInteger(total) &&
        given >= total
      ) {
        throw Error(
          "No Hit the Box chocolates remaining."
        );
      }

      tx.set(recordRef,{
        gameType:"hit-box",
        word:current.hbWord || "",
        roundId:Number(current.hbRoundId || 0),
        outcome:won ? "won" : "lost",
        chocolate:won ? 1 : 0,
        durationSec:sec,
        elapsedSec:Math.min(sec,Math.round(elapsed)),
        at:FV.serverTimestamp()
      });

      tx.set(statsRef,{
        hbPlayed:FV.increment(1),
        hbWins:FV.increment(won ? 1 : 0),
        hbLosses:FV.increment(won ? 0 : 1),
        hbChocolates:FV.increment(won ? 1 : 0)
      },{merge:true});

      tx.set(liveRef,{
        hbStage:"idle",
        hbWord:"",
        hbStartedAt:null,
        hbLastOutcome:won ? "won" : "lost",
        hbLastResultAt:FV.serverTimestamp()
      },{merge:true});
    });

    message(
      won
        ? "🍫 WON! One chocolate recorded."
        : "NOT WON recorded. No chocolate awarded."
    );
  }

  // CANCEL WITHOUT RECORDING

  async function cancelRound() {
    if (!confirm(
      "Cancel this round without recording a result?"
    )) return;

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);
      const current = snap.data() || {};

      if (
        current.hbStage !== "running" &&
        current.hbStage !== "ready"
      ) return;

      tx.set(liveRef,{
        hbStage:"idle",
        hbWord:"",
        hbStartedAt:null
      },{merge:true});
    });

    message("Round cancelled. No chocolate counted.");
  }

  // SAVE TIMER

  async function saveTime() {
    // Read the typed value BEFORE rendering again.

    const sec = parseTime($("hbDurationInput").value);

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);
      const current = snap.data() || {};

      tx.set(settingsRef,{
        hbDurationSec:sec
      },{merge:true});

      if (current.hbStage === "idle" || !current.hbStage) {
        tx.set(liveRef,{
          hbDurationSec:sec
        },{merge:true});
      }
    });

    settings.hbDurationSec = sec;
    timeDirty = false;
    $("hbDurationInput").value = formatTime(sec);

    message("✅ Timer saved: " + formatTime(sec));
  }

  // SAVE WORDS AND MODE

  async function saveWords() {
    const words = validWords($("hbWordsInput").value);
    const mode = $("hbMode").value;

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);

      if (snap.data()?.hbStage === "running") {
        throw Error(
          "Finish or cancel the active round first."
        );
      }

      tx.set(settingsRef,{
        hbWords:words,
        hbMode:mode
      },{merge:true});

      tx.set(liveRef,{
        hbUsedWords:[],
        hbStage:"idle",
        hbWord:"",
        hbStartedAt:null
      },{merge:true});
    });

    settings.hbWords = words;
    settings.hbMode = mode;

    wordsDirty = false;
    modeDirty = false;

    message("Word bank and randomizer mode saved.");
  }

  // RESET USED WORDS ONLY

  async function resetCycle() {
    if (!confirm("Reset the used-word cycle?")) return;

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);

      if (snap.data()?.hbStage === "running") {
        throw Error("Finish the active round first.");
      }

      tx.set(liveRef,{
        hbUsedWords:[]
      },{merge:true});
    });

    message("Used words reset. Records are unchanged.");
  }

  // STOCK

  async function saveStock() {
    const raw = $("hbStockInput").value.trim();
    const total = Number(raw);

    if (
      !raw ||
      !Number.isSafeInteger(total) ||
      total < 0
    ) {
      throw Error("Enter a valid whole-number stock.");
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(statsRef);
      const given = Number(snap.data()?.hbChocolates || 0);

      if (total < given) {
        throw Error(
          "Total stock cannot be below " +
          given +
          " chocolates already given."
        );
      }

      tx.set(statsRef,{
        hbStockTotal:total
      },{merge:true});
    });

    $("hbStockInput").value = "";
    message("Hit the Box stock saved.");
  }

  // SESSION COUNTERS

  function sessionCount(key) {
    const base =
      "hbBase" +
      key.slice(2);

    return Math.max(
      0,
      Number(stats[key] || 0) -
      Number(stats[base] || 0)
    );
  }

  function belongsToSession(record) {
    const start = millis(live.hbSessionStartedAt);

    return !start || millis(record.at) > start;
  }

  // RESET SESSION, NOT LIFETIME TOTALS

  async function resetSession() {
    if (!statsReady || !historyReady) {
      throw Error("Wait for the records to finish loading.");
    }

    if (!confirm(
      "Start a NEW Hit the Box session?\n\n" +
      "Displayed counts restart from zero.\n" +
      "Old records and chocolates stay saved."
    )) return;

    await db.runTransaction(async tx => {
      const [liveSnap,statsSnap] = await Promise.all([
        tx.get(liveRef),
        tx.get(statsRef)
      ]);

      if (liveSnap.data()?.hbStage === "running") {
        throw Error("Finish the current round first.");
      }

      const s = statsSnap.data() || {};

      tx.set(statsRef,{
        hbBasePlayed:Number(s.hbPlayed || 0),
        hbBaseWins:Number(s.hbWins || 0),
        hbBaseLosses:Number(s.hbLosses || 0),
        hbBaseChocolates:Number(s.hbChocolates || 0)
      },{merge:true});

      tx.set(liveRef,{
        hbSessionStartedAt:FV.serverTimestamp(),
        hbStage:"idle",
        hbWord:"",
        hbStartedAt:null,
        hbLastOutcome:""
      },{merge:true});
    });

    message(
      "New session started. Previous data and stock preserved."
    );
  }

  // DISPLAY HISTORY

  function dateText(value) {
    return value?.toDate
      ? value.toDate().toLocaleString("en-US",{
          dateStyle:"medium",
          timeStyle:"short"
        })
      : "Saving…";
  }

  function sortedRecords() {
    return [...records].sort(
      (a,b) => millis(b.at) - millis(a.at)
    );
  }

  function renderHistory() {
    if (!isAdmin || !authorized) return;

    const tbody = $("hbRecords");
    tbody.replaceChildren();

    const items = sortedRecords()
      .filter(belongsToSession)
      .slice(0,100);

    if (!items.length) {
      const cell = tbody.insertRow().insertCell();
      cell.colSpan = 5;
      cell.textContent = "No rounds in this session.";
      return;
    }

    for (const item of items) {
      const row = tbody.insertRow();

      [
        dateText(item.at),
        item.word || "—",
        item.outcome === "won" ? "WON" : "NOT WON",
        item.chocolate || 0,
        formatTime(item.elapsedSec || 0)
      ].forEach(value => {
        row.insertCell().textContent = String(value);
      });
    }
  }

  // CSV EXPORT

  function csvCell(value) {
    let text = String(value ?? "");

    if (/^\s*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replaceAll('"','""') + '"';
  }

  async function exportCSV(all) {
    const snap = await historyRef
      .where("gameType","==","hit-box")
      .get();

    const allRecords = snap.docs.map(d => d.data());

    const chosen = all
      ? allRecords
      : allRecords.filter(belongsToSession);

    chosen.sort((a,b) => millis(b.at) - millis(a.at));

    const rows = [[
      "Date",
      "Round",
      "Arabic Word",
      "Result",
      "Chocolates",
      "Duration Seconds",
      "Time Used Seconds"
    ]];

    chosen.forEach(x => {
      rows.push([
        x.at?.toDate?.().toISOString() || "",
        x.roundId || "",
        x.word || "",
        x.outcome || "",
        x.chocolate || 0,
        x.durationSec || 0,
        x.elapsedSec || 0
      ]);
    });

    const csv = "\uFEFF" +
      rows.map(row => row.map(csvCell).join(","))
        .join("\r\n");

    const blob = new Blob(
      [csv],
      {type:"text/csv;charset=utf-8"}
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = all
      ? "edex-hit-box-all-history.csv"
      : "edex-hit-box-session.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url),1000);

    message("CSV exported.");
  }

  // MAIN SCREEN RENDER

  function render() {
    const currentStage = stage();
    const left = currentStage === "expired" ? 0 : timeLeft();

    if ($("hitWord")) {
      $("hitWord").textContent = live.hbWord || "✦";
    }

    if ($("hitClock")) {
      $("hitClock").textContent = formatTime(left);
    }

    if ($("hitStage")) {
      $("hitStage").textContent =
        currentStage.toUpperCase();
    }

    if ($("hitRoundNumber")) {
      $("hitRoundNumber").textContent =
        "Round " + Number(live.hbRoundId || 0);
    }

    if ($("hitResult")) {
      const fresh =
        millis(live.hbLastResultAt) > 0 &&
        Date.now() - millis(live.hbLastResultAt) < 8000;

      let result = "Randomize a word to start.";

      if (currentStage === "ready") {
        result = "Word ready. Start the timer.";
      } else if (currentStage === "running") {
        result = "Hit the letters before time runs out!";
      } else if (currentStage === "expired") {
        result = "TIME UP — record NOT WON.";
      } else if (fresh && live.hbLastOutcome === "won") {
        result = "🍫 CHOCOLATE WON!";
      } else if (fresh && live.hbLastOutcome === "lost") {
        result = "✕ NOT WON";
      }

      $("hitResult").textContent = result;
    }

    for (const id of [
      "hitRandomBtn",
      "hitStartBtn",
      "hitWonBtn",
      "hitFailedBtn",
      "hitCancelBtn"
    ]) {
      if ($(id)) $(id).disabled = !authorized || busy;
    }

    if ($("hitRandomBtn")) {
      $("hitRandomBtn").disabled =
        !authorized || busy ||
        currentStage === "running" ||
        currentStage === "expired";
    }

    if ($("hitStartBtn")) {
      $("hitStartBtn").disabled =
        !authorized || busy ||
        currentStage !== "ready";
    }

    if ($("hitWonBtn")) {
      $("hitWonBtn").disabled =
        !authorized || busy ||
        currentStage !== "running";
    }

    if ($("hitFailedBtn")) {
      $("hitFailedBtn").disabled =
        !authorized || busy ||
        !["running","expired"].includes(currentStage);
    }

    if ($("hitCancelBtn")) {
      $("hitCancelBtn").disabled =
        !authorized || busy ||
        currentStage === "idle";
    }

    $("hitLogin").hidden = authorized;

    if (isAdmin) {
      $("hitAdmin").hidden = !authorized;
    } else {
      $("hitControls").hidden = !authorized;
    }

    if (isAdmin && authorized) {
      renderAdmin();
    }
  }

  // ADMIN COUNTERS AND SETTINGS

  function renderAdmin() {
    $("hbPlayed").textContent =
      sessionCount("hbPlayed");

    $("hbWins").textContent =
      sessionCount("hbWins");

    $("hbLosses").textContent =
      sessionCount("hbLosses");

    $("hbChocolates").textContent =
      sessionCount("hbChocolates");

    const total = stats.hbStockTotal;
    const tracked =
      Number.isSafeInteger(total) && total >= 0;

    $("hbStock").textContent =
      tracked ? total : "Not set";

    $("hbRemaining").textContent =
      tracked
        ? Math.max(
            0,
            total - Number(stats.hbChocolates || 0)
          )
        : "Not set";

    // Never overwrite time being typed.

    if (
      !timeDirty &&
      document.activeElement !== $("hbDurationInput")
    ) {
      $("hbDurationInput").value =
        formatTime(settings.hbDurationSec || 90);
    }

    if (
      !wordsDirty &&
      document.activeElement !== $("hbWordsInput")
    ) {
      $("hbWordsInput").value =
        (settings.hbWords || DEFAULT_WORDS).join("، ");
    }

    if (!modeDirty) {
      $("hbMode").value = settings.hbMode || "words";
    }

    for (const id of [
      "hbSaveTime","hbSaveWords","hbResetCycle",
      "hbSaveStock","hbSessionCsv","hbAllCsv",
      "hbResetSession"
    ]) {
      $(id).disabled = !authorized || busy;
    }

    renderHistory();
  }

  // ORGANIZER LOGIN

  $("hitLoginForm").addEventListener("submit",async e => {
    e.preventDefault();
    $("hitLoginError").textContent = "";

    try {
      const credential =
        await auth.signInWithEmailAndPassword(
          $("hitEmail").value.trim(),
          $("hitPassword").value
        );

      if (credential.user.uid !== ADMIN_UID) {
        await auth.signOut();
        throw Error("This is not the organizer account.");
      }

      $("hitPassword").value = "";
    } catch(err) {
      $("hitLoginError").textContent =
        err?.message || "Login failed.";
    }
  });

  $("hitLogout").onclick = () => {
    if (!busy) auth.signOut();
  };

  // CONNECT CONTROLS

  function bind(id,work) {
    $(id).addEventListener("click",() => perform(work));
  }

  bind("hitRandomBtn",randomize);
  bind("hitStartBtn",startRound);
  bind("hitWonBtn",() => finishRound(true));
  bind("hitFailedBtn",() => finishRound(false));
  bind("hitCancelBtn",cancelRound);

  if (isAdmin) {
    $("hbDurationInput").addEventListener(
      "input",() => { timeDirty = true; }
    );

    $("hbWordsInput").addEventListener(
      "input",() => { wordsDirty = true; }
    );

    $("hbMode").addEventListener(
      "change",() => { modeDirty = true; }
    );

    bind("hbSaveTime",saveTime);
    bind("hbSaveWords",saveWords);
    bind("hbResetCycle",resetCycle);
    bind("hbSaveStock",saveStock);
    bind("hbResetSession",resetSession);
    bind("hbSessionCsv",() => exportCSV(false));
    bind("hbAllCsv",() => exportCSV(true));
  }

  // FIREBASE LIVE SYNCHRONIZATION

  liveRef.onSnapshot(
    snap => {
      live = snap.data() || {};

      if ($("connection")) {
        $("connection").textContent = "● LIVE";
      }

      render();
    },
    err => {
      if ($("connection")) {
        $("connection").textContent = "● OFFLINE";
      }

      message("Live data: " + err.message,true);
    }
  );

  function stopPrivate() {
    unsubPrivate.forEach(fn => fn());
    unsubPrivate = [];
  }

  function watchPrivate() {
    unsubPrivate.push(
      settingsRef.onSnapshot(
        snap => {
          settings = {
            hbDurationSec:90,
            hbMode:"words",
            hbWords:DEFAULT_WORDS,
            ...(snap.data() || {})
          };

          render();
        },
        err => message("Settings: " + err.message,true)
      )
    );

    if (!isAdmin) return;

    unsubPrivate.push(
      statsRef.onSnapshot(
        snap => {
          stats = snap.data() || {};
          statsReady = true;
          render();
        },
        err => message("Stats: " + err.message,true)
      )
    );

    unsubPrivate.push(
      historyRef
        .where("gameType","==","hit-box")
        .onSnapshot(
          snap => {
            records = snap.docs.map(d => d.data());
            historyReady = true;
            renderHistory();
          },
          err => message("History: " + err.message,true)
        )
    );
  }

  auth.onAuthStateChanged(async user => {
    stopPrivate();

    authorized = Boolean(
      user && user.uid === ADMIN_UID
    );

    if (user && !authorized) {
      await auth.signOut();
      return;
    }

    if (authorized) {
      watchPrivate();
    }

    render();
  });

  setInterval(render,200);
  render();

})();
