
/*
 EDEX — HIT THE BOX
 Complete replacement for hitbox.js

 Letters: ا ب ت ث
 Letter ج completely removed.

 All combinations: 4 x 4 x 4 = 64

 Keeps Firebase records, chocolate counts,
 timer, organizer login and session reset.
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const adminPage =
    document.body.dataset.hitPage === "admin";

  const FV = firebase.firestore.FieldValue;

  const liveRef =
    db.collection("wordPortal").doc("live");

  const settingsRef =
    db.collection("wordSettings").doc("main");

  const statsRef =
    db.collection("wordStats").doc("total");

  const historyRef =
    db.collection("wordHistory");

  // ONLY THE FOUR AVAILABLE LETTERS

  const LETTERS = ["ا", "ب", "ت", "ث"];

  const WORD_RE = /^[ابتث]{3}$/u;

  const DEFAULT_WORDS = [
    "باب", "بات", "تاب", "ثاب",
    "ثبت", "تبت", "بثت", "بتت"
  ];

  const GAME = "hit-box";

  let authorized = false;
  let busy = false;
  let statsReady = false;
  let historyReady = false;

  let timeDirty = false;
  let wordsDirty = false;
  let modeDirty = false;

  let live = {};
  let stats = {};
  let history = [];

  let settings = {
    hbDurationSec: 90,
    hbMode: "words",
    hbWords: DEFAULT_WORDS
  };

  let privateListeners = [];

  // REMOVE UNAVAILABLE WORDS FROM OLD BANK

  function validSavedWords(list) {
    if (!Array.isArray(list)) {
      return [...DEFAULT_WORDS];
    }

    const allowed = [
      ...new Set(
        list.map(x =>
          String(x).normalize("NFC").trim()
        )
      )
    ].filter(x => WORD_RE.test(x));

    return allowed.length
      ? allowed
      : [...DEFAULT_WORDS];
  }

  // AUTOMATICALLY REMOVE ج FROM THE
  // EXISTING VISITOR AND ADMIN PAGES

  function removeJeemFromScreen() {

    document.querySelectorAll(
      ".targets .target"
    ).forEach(el => {

      if (el.textContent.trim() === "ج") {
        el.remove();
      }

    });

    document.querySelectorAll(
      "option, .note, .word-label, p"
    ).forEach(el => {

      for (const node of el.childNodes) {

        if (node.nodeType !== Node.TEXT_NODE) {
          continue;
        }

        node.textContent = node.textContent
          .replace(
            /All 125 Combinations/gi,
            "All 64 Combinations"
          )
          .replace(
            /Five letters/gi,
            "Four letters"
          )
          .replace(
            /5 letters/gi,
            "4 letters"
          )
          .replace(
            /ا\s*ب\s*ت\s*ث\s*ج/g,
            "ا ب ت ث"
          );
      }

    });
  }

  // FORMAT TIMER AS MM:SS

  function formatTime(s) {

    const n = Math.max(
      0,
      Math.ceil(Number(s) || 0)
    );

    return (
      String(Math.floor(n / 60))
        .padStart(2, "0") +
      ":" +
      String(n % 60).padStart(2, "0")
    );
  }

  // ACCEPT 00:20 OR 20

  function parseTime(value) {

    const raw = String(value).trim();

    let n;

    if (/^\d{1,2}:[0-5]\d$/.test(raw)) {

      const [m, s] =
        raw.split(":").map(Number);

      n = m * 60 + s;

    } else if (/^\d{1,3}$/.test(raw)) {

      n = Number(raw);

    } else {

      throw Error(
        "Type 00:20 for 20 seconds, " +
        "or 01:30 for 90 seconds."
      );
    }

    if (
      !Number.isSafeInteger(n) ||
      n < 10 ||
      n > 900
    ) {
      throw Error(
        "Time must be between 00:10 and 15:00."
      );
    }

    return n;
  }

  const millis = value =>
    value?.toMillis?.() || 0;

  function duration() {

    const n = Number(
      live.hbStage === "running"
        ? live.hbDurationSec
        : settings.hbDurationSec
    );

    return Number.isFinite(n) && n >= 10
      ? n
      : 90;
  }

  function timeLeft() {

    if (
      live.hbStage !== "running" ||
      !millis(live.hbStartedAt)
    ) {
      return duration();
    }

    return Math.max(
      0,
      (
        millis(live.hbStartedAt) +
        duration() * 1000 -
        Date.now()
      ) / 1000
    );
  }

  function stage() {

    if (live.hbStage === "running") {

      return (
        millis(live.hbStartedAt) &&
        timeLeft() <= 0
      )
        ? "expired"
        : "running";
    }

    return live.hbStage || "idle";
  }

  // DISPLAY FEEDBACK

  function message(text, error = false) {

    const el = $("hitMessage");

    if (!el) return;

    el.textContent = text;

    el.style.color = error
      ? "#ff9eaf"
      : "#aaf0cd";
  }

  // PREVENT DOUBLE CLICKS

  async function perform(work) {

    if (!authorized || busy) return;

    busy = true;

    try {
      await work();

    } catch (e) {

      console.error(e);

      message(
        e?.message ||
        "Could not save. Check Firebase permissions.",
        true
      );

    } finally {

      busy = false;
      render();
    }
  }

  // VALIDATE APPROVED WORDS

  function parseNewWords(raw) {

    const words = [
      ...new Set(
        String(raw)
          .normalize("NFC")
          .split(/[\s,،؛;]+/u)
          .map(x => x.trim())
          .filter(Boolean)
      )
    ];

    if (!words.length) {
      throw Error("Enter at least one word.");
    }

    if (
      words.some(x => !WORD_RE.test(x))
    ) {
      throw Error(
        "Use only three-letter words " +
        "made from ا ب ت ث. " +
        "Letter ج is not allowed."
      );
    }

    return words;
  }

  // GENERATE ALL 64 COMBINATIONS

  function allCombinations() {

    const result = [];

    for (const a of LETTERS) {
      for (const b of LETTERS) {
        for (const c of LETTERS) {
          result.push(a + b + c);
        }
      }
    }

    return result;
  }

  function poolFrom(saved) {

    return saved.hbMode === "all"
      ? allCombinations()
      : validSavedWords(saved.hbWords);
  }

  // RANDOMIZE WITHOUT ج

  async function randomize() {

    await db.runTransaction(async tx => {

      const [roundSnap, settingSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(settingsRef)
        ]);

      const current =
        roundSnap.data() || {};

      const saved =
        settingSnap.data() || {};

      if (current.hbStage === "running") {
        throw Error(
          "Finish or cancel this round first."
        );
      }

      const pool = poolFrom(saved);

      let used =
        Array.isArray(current.hbUsedWords)
          ? current.hbUsedWords.filter(
              w => pool.includes(w)
            )
          : [];

      let available =
        pool.filter(w => !used.includes(w));

      if (!available.length) {

        used = [];

        available = pool.filter(
          w => w !== current.hbWord
        );

        if (!available.length) {
          available = [...pool];
        }
      }

      const word =
        available[
          Math.floor(
            Math.random() * available.length
          )
        ];

      used.push(word);

      tx.set(liveRef, {

        hbStage: "ready",

        hbWord: word,

        hbStartedAt: null,

        hbDurationSec:
          Number(saved.hbDurationSec || 90),

        hbUsedWords: used,

        hbRoundId:
          Number(current.hbRoundId || 0) + 1,

        hbLastOutcome: ""

      }, {merge: true});
    });

    message(
      "New word generated using only ا ب ت ث."
    );
  }

  // START TIMER

  async function startRound() {

    await db.runTransaction(async tx => {

      const snap = await tx.get(liveRef);

      const current = snap.data() || {};

      if (
        current.hbStage !== "ready" ||
        !WORD_RE.test(current.hbWord || "")
      ) {
        throw Error(
          "Press NEW WORD first to get " +
          "a word without ج."
        );
      }

      tx.set(liveRef, {

        hbStage: "running",

        hbStartedAt:
          FV.serverTimestamp()

      }, {merge: true});
    });

    message("Timer started!");
  }

  // WON OR NOT WON

  async function finishRound(won) {

    const recordRef = historyRef.doc();

    await db.runTransaction(async tx => {

      const [roundSnap, statSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      const round =
        roundSnap.data() || {};

      const stat =
        statSnap.data() || {};

      if (
        round.hbStage !== "running" ||
        !millis(round.hbStartedAt)
      ) {
        throw Error(
          "There is no active round."
        );
      }

      if (
        !WORD_RE.test(round.hbWord || "")
      ) {
        throw Error(
          "Old round contains an unavailable letter. " +
          "Cancel and choose NEW WORD."
        );
      }

      const secs =
        Number(round.hbDurationSec || 90);

      const elapsed = Math.max(
        0,
        (
          Date.now() -
          millis(round.hbStartedAt)
        ) / 1000
      );

      if (won && elapsed >= secs) {
        throw Error(
          "Time is up. Choose NOT WON."
        );
      }

      if (
        won &&
        Number.isSafeInteger(
          stat.hbStockTotal
        ) &&
        Number(stat.hbChocolates || 0) >=
          stat.hbStockTotal
      ) {
        throw Error(
          "Hit the Box has no chocolates left."
        );
      }

      // SAVE RESULT

      tx.set(recordRef, {

        gameType: GAME,

        word: round.hbWord,

        roundId:
          Number(round.hbRoundId || 0),

        outcome:
          won ? "won" : "lost",

        chocolate:
          won ? 1 : 0,

        durationSec: secs,

        elapsedSec:
          Math.min(secs, Math.round(elapsed)),

        at: FV.serverTimestamp()

      });

      // UPDATE CHOCOLATE COUNTERS

      tx.set(statsRef, {

        hbPlayed: FV.increment(1),

        hbWins:
          FV.increment(won ? 1 : 0),

        hbLosses:
          FV.increment(won ? 0 : 1),

        hbChocolates:
          FV.increment(won ? 1 : 0)

      }, {merge: true});

      // END CURRENT ROUND

      tx.set(liveRef, {

        hbStage: "idle",

        hbWord: "",

        hbStartedAt: null,

        hbLastOutcome:
          won ? "won" : "lost",

        hbLastResultAt:
          FV.serverTimestamp()

      }, {merge: true});
    });

    message(
      won
        ? "🍫 WON — one chocolate recorded."
        : "NOT WON — no chocolate."
    );
  }

  // CANCEL CURRENT ROUND

  async function cancelRound() {

    if (!confirm(
      "Cancel this round without recording a result?"
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const snap = await tx.get(liveRef);

      const state = snap.data() || {};

      if (
        state.hbStage !== "running" &&
        state.hbStage !== "ready"
      ) {
        return;
      }

      tx.set(liveRef, {

        hbStage: "idle",

        hbWord: "",

        hbStartedAt: null

      }, {merge: true});
    });

    message(
      "Round cancelled; no chocolate counted."
    );
  }

  // SAVE TIMER

  async function saveTimer() {

    const secs =
      parseTime($("hbDurationInput").value);

    await db.runTransaction(async tx => {

      const snap = await tx.get(liveRef);

      tx.set(settingsRef, {
        hbDurationSec: secs
      }, {merge: true});

      if (
        !snap.data()?.hbStage ||
        snap.data().hbStage === "idle"
      ) {
        tx.set(liveRef, {
          hbDurationSec: secs
        }, {merge: true});
      }
    });

    settings.hbDurationSec = secs;

    timeDirty = false;

    $("hbDurationInput").value =
      formatTime(secs);

    message(
      "✅ Timer saved: " + formatTime(secs)
    );
  }

  // SAVE WORD BANK

  async function saveWords() {

    const words =
      parseNewWords($("hbWordsInput").value);

    const mode = $("hbMode").value;

    await db.runTransaction(async tx => {

      const snap = await tx.get(liveRef);

      if (
        snap.data()?.hbStage === "running"
      ) {
        throw Error(
          "Finish the active round first."
        );
      }

      tx.set(settingsRef, {

        hbWords: words,

        hbMode: mode

      }, {merge: true});

      tx.set(liveRef, {

        hbStage: "idle",

        hbWord: "",

        hbUsedWords: [],

        hbStartedAt: null

      }, {merge: true});
    });

    settings.hbWords = words;
    settings.hbMode = mode;

    wordsDirty = false;
    modeDirty = false;

    message(
      "Word bank saved — ج excluded."
    );
  }

  // RESET USED WORDS

  async function resetUsedWords() {

    if (!confirm(
      "Reset the randomizer cycle?"
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const snap = await tx.get(liveRef);

      if (
        snap.data()?.hbStage === "running"
      ) {
        throw Error(
          "Finish the active round first."
        );
      }

      tx.set(liveRef, {
        hbUsedWords: []
      }, {merge: true});
    });

    message(
      "Used words reset. History preserved."
    );
  }

  // SAVE CHOCOLATE STOCK

  async function saveStock() {

    const raw =
      $("hbStockInput").value.trim();

    const amount = Number(raw);

    if (
      !raw ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    ) {
      throw Error(
        "Enter a whole number for stock."
      );
    }

    await db.runTransaction(async tx => {

      const snap = await tx.get(statsRef);

      const given =
        Number(
          snap.data()?.hbChocolates || 0
        );

      if (amount < given) {
        throw Error(
          "Stock cannot be below " +
          given +
          " chocolates already awarded."
        );
      }

      tx.set(statsRef, {
        hbStockTotal: amount
      }, {merge: true});
    });

    $("hbStockInput").value = "";

    message("Chocolate stock saved.");
  }

  // SESSION COUNTERS

  function sessionCount(field) {

    const baseline =
      "hbBase" + field.slice(2);

    return Math.max(
      0,
      Number(stats[field] || 0) -
      Number(stats[baseline] || 0)
    );
  }

  function isCurrentRecord(record) {

    const start =
      millis(live.hbSessionStartedAt);

    return !start ||
      millis(record.at) > start;
  }

  // RESET SESSION WITHOUT DELETING HISTORY

  async function resetSession() {

    if (!statsReady || !historyReady) {
      throw Error(
        "Wait for history and statistics to load."
      );
    }

    if (!confirm(
      "Reset Hit the Box SESSION?\n" +
      "Previous records and awarded chocolates " +
      "stay saved."
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const [liveSnap, statSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      if (
        liveSnap.data()?.hbStage === "running"
      ) {
        throw Error(
          "Finish the active round first."
        );
      }

      const s = statSnap.data() || {};

      tx.set(statsRef, {

        hbBasePlayed:
          Number(s.hbPlayed || 0),

        hbBaseWins:
          Number(s.hbWins || 0),

        hbBaseLosses:
          Number(s.hbLosses || 0),

        hbBaseChocolates:
          Number(s.hbChocolates || 0)

      }, {merge: true});

      tx.set(liveRef, {

        hbStage: "idle",

        hbWord: "",

        hbStartedAt: null,

        hbSessionStartedAt:
          FV.serverTimestamp()

      }, {merge: true});
    });

    message(
      "Session reset. Historical records " +
      "and chocolate stock preserved."
    );
  }

  // DATE FORMAT

  function dateText(stamp) {

    return stamp?.toDate?.()
      ? stamp.toDate().toLocaleString(
          "en-US", {
            dateStyle: "medium",
            timeStyle: "short"
          }
        )
      : "Saving…";
  }

  // SHOW RECENT HISTORY

  function renderHistory() {

    if (!adminPage || !authorized) return;

    const body = $("hbRecords");

    body.replaceChildren();

    const rows = [...history]
      .filter(isCurrentRecord)
      .sort((a, b) =>
        millis(b.at) - millis(a.at)
      )
      .slice(0, 100);

    if (!rows.length) {

      const cell =
        body.insertRow().insertCell();

      cell.colSpan = 5;

      cell.textContent =
        "No rounds this session.";

      return;
    }

    for (const item of rows) {

      const row = body.insertRow();

      [
        dateText(item.at),

        item.word || "—",

        item.outcome === "won"
          ? "WON"
          : "NOT WON",

        item.chocolate || 0,

        formatTime(item.elapsedSec || 0)

      ].forEach(value => {

        row.insertCell().textContent =
          String(value);

      });
    }
  }

  // SAFE CSV EXPORT

  function csvCell(value) {

    let s = String(value ?? "");

    if (/^\s*[=+@\-]/.test(s)) {
      s = "'" + s;
    }

    return '"' +
      s.replaceAll('"', '""') +
      '"';
  }

  async function exportCSV(all) {

    const snap =
      await historyRef
        .where("gameType", "==", GAME)
        .get();

    const records = snap.docs
      .map(doc => doc.data())
      .filter(x =>
        all || isCurrentRecord(x)
      )
      .sort((a, b) =>
        millis(b.at) - millis(a.at)
      );

    const rows = [[
      "Date",
      "Round",
      "Arabic word",
      "Result",
      "Chocolates",
      "Time allowed (s)",
      "Time used (s)"
    ]];

    for (const x of records) {

      rows.push([
        x.at?.toDate?.().toISOString() || "",
        x.roundId || "",
        x.word || "",
        x.outcome || "",
        x.chocolate || 0,
        x.durationSec || 0,
        x.elapsedSec || 0
      ]);
    }

    const csv = "\uFEFF" +
      rows.map(r =>
        r.map(csvCell).join(",")
      ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob(
        [csv],
        {type: "text/csv;charset=utf-8"}
      )
    );

    const a = document.createElement("a");

    a.href = url;

    a.download = all
      ? "hitbox-all-history.csv"
      : "hitbox-session.csv";

    document.body.appendChild(a);

    a.click();
    a.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    message("CSV exported.");
  }

  // UPDATE VISITOR AND ADMIN SCREENS

  function render() {

    const status = stage();

    const displayedWord =
      WORD_RE.test(live.hbWord || "")
        ? live.hbWord
        : "✦";

    if ($("hitWord")) {
      $("hitWord").textContent =
        displayedWord;
    }

    if ($("hitClock")) {

      $("hitClock").textContent =
        formatTime(
          status === "expired"
            ? 0
            : timeLeft()
        );
    }

    if ($("hitStage")) {
      $("hitStage").textContent =
        status.toUpperCase();
    }

    if ($("hitRoundNumber")) {

      $("hitRoundNumber").textContent =
        "Round " +
        Number(live.hbRoundId || 0);
    }

    if ($("hitResult")) {

      const fresh =
        millis(live.hbLastResultAt) &&
        Date.now() -
        millis(live.hbLastResultAt) < 8000;

      let result =
        "Randomize a word to begin.";

      if (
        (status === "ready" ||
         status === "running") &&
        !WORD_RE.test(live.hbWord || "")
      ) {

        result =
          "Old word uses an unavailable letter. " +
          "Cancel this round, then choose NEW WORD.";

      } else if (status === "ready") {

        result =
          "Word ready. Start the timer.";

      } else if (status === "running") {

        result =
          "Hit the correct letter boxes!";

      } else if (status === "expired") {

        result =
          "TIME UP — choose NOT WON.";

      } else if (
        fresh &&
        live.hbLastOutcome === "won"
      ) {

        result = "🍫 CHOCOLATE WON!";

      } else if (
        fresh &&
        live.hbLastOutcome === "lost"
      ) {

        result = "NOT WON";
      }

      $("hitResult").textContent = result;
    }

    const can = {

      hitRandomBtn:
        status !== "running" &&
        status !== "expired",

      hitStartBtn:
        status === "ready" &&
        WORD_RE.test(live.hbWord || ""),

      hitWonBtn:
        status === "running" &&
        WORD_RE.test(live.hbWord || ""),

      hitFailedBtn:
        status === "running" ||
        status === "expired",

      hitCancelBtn:
        status !== "idle"
    };

    for (const [id, enabled] of
      Object.entries(can)) {

      if ($(id)) {

        $(id).disabled =
          !authorized ||
          busy ||
          !enabled;
      }
    }

    $("hitLogin").hidden = authorized;

    if (adminPage) {

      $("hitAdmin").hidden = !authorized;

      if (authorized) {
        renderAdmin();
      }

    } else {

      $("hitControls").hidden =
        !authorized;
    }
  }

  // ADMIN STATISTICS AND SETTINGS

  function renderAdmin() {

    for (const id of [
      "hbPlayed",
      "hbWins",
      "hbLosses",
      "hbChocolates"
    ]) {

      $(id).textContent =
        String(sessionCount(id));
    }

    const total = stats.hbStockTotal;

    const tracked =
      Number.isSafeInteger(total) &&
      total >= 0;

    $("hbStock").textContent =
      tracked
        ? String(total)
        : "Not set";

    $("hbRemaining").textContent =
      tracked
        ? String(
            Math.max(
              0,
              total -
              Number(stats.hbChocolates || 0)
            )
          )
        : "Not set";

    // DON'T OVERWRITE TIMER WHILE TYPING

    if (
      !timeDirty &&
      document.activeElement !==
        $("hbDurationInput")
    ) {

      $("hbDurationInput").value =
        formatTime(
          settings.hbDurationSec || 90
        );
    }

    // AUTOMATICALLY FILTER OLD WORD BANKS

    if (
      !wordsDirty &&
      document.activeElement !==
        $("hbWordsInput")
    ) {

      $("hbWordsInput").value =
        validSavedWords(
          settings.hbWords
        ).join("، ");
    }

    if (!modeDirty) {

      $("hbMode").value =
        settings.hbMode === "all"
          ? "all"
          : "words";
    }

    for (const id of [
      "hbSaveTime",
      "hbSaveWords",
      "hbResetCycle",
      "hbSaveStock",
      "hbSessionCsv",
      "hbAllCsv",
      "hbResetSession"
    ]) {

      $(id).disabled =
        !authorized || busy;
    }
  }

  // ORGANIZER LOGIN

  $("hitLoginForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      $("hitLoginError").textContent = "";

      try {

        const info =
          await auth.signInWithEmailAndPassword(
            $("hitEmail").value.trim(),
            $("hitPassword").value
          );

        if (
          info.user.uid !== ADMIN_UID
        ) {

          await auth.signOut();

          throw Error(
            "This is not the organizer account."
          );
        }

        $("hitPassword").value = "";

      } catch (e) {

        $("hitLoginError").textContent =
          e?.message || "Login failed.";
      }
    }
  );

  // SIGN OUT

  $("hitLogout").onclick = () => {

    if (!busy) {
      auth.signOut();
    }
  };

  // CONNECT ALL BUTTONS

  function bind(id, fn) {

    $(id).addEventListener(
      "click",
      () => perform(fn)
    );
  }

  bind("hitRandomBtn", randomize);

  bind("hitStartBtn", startRound);

  bind(
    "hitWonBtn",
    () => finishRound(true)
  );

  bind(
    "hitFailedBtn",
    () => finishRound(false)
  );

  bind("hitCancelBtn", cancelRound);

  if (adminPage) {

    $("hbDurationInput").addEventListener(
      "input",
      () => {
        timeDirty = true;
      }
    );

    $("hbWordsInput").addEventListener(
      "input",
      () => {
        wordsDirty = true;
      }
    );

    $("hbMode").addEventListener(
      "change",
      () => {
        modeDirty = true;
      }
    );

    bind("hbSaveTime", saveTimer);

    bind("hbSaveWords", saveWords);

    bind("hbResetCycle", resetUsedWords);

    bind("hbSaveStock", saveStock);

    bind("hbResetSession", resetSession);

    bind(
      "hbSessionCsv",
      () => exportCSV(false)
    );

    bind(
      "hbAllCsv",
      () => exportCSV(true)
    );
  }

  // LIVE FIREBASE LISTENER

  liveRef.onSnapshot(

    snap => {

      live = snap.data() || {};

      if ($("connection")) {
        $("connection").textContent =
          "● LIVE";
      }

      render();
    },

    e => {

      if ($("connection")) {
        $("connection").textContent =
          "● OFFLINE";
      }

      message(
        "Live: " + e.message,
        true
      );
    }
  );

  // PRIVATE DATA LISTENERS

  function stopPrivate() {

    privateListeners.forEach(fn => fn());

    privateListeners = [];
  }

  function listenPrivate() {

    privateListeners.push(
      settingsRef.onSnapshot(

        snap => {

          settings = {

            hbDurationSec: 90,

            hbMode: "words",

            hbWords: DEFAULT_WORDS,

            ...(snap.data() || {})
          };

          render();
        },

        e => message(
          "Settings: " + e.message,
          true
        )
      )
    );

    if (!adminPage) return;

    privateListeners.push(
      statsRef.onSnapshot(

        snap => {

          stats = snap.data() || {};

          statsReady = true;

          render();
        },

        e => message(
          "Statistics: " + e.message,
          true
        )
      )
    );

    privateListeners.push(
      historyRef
        .where("gameType", "==", GAME)
        .onSnapshot(

          snap => {

            history =
              snap.docs.map(
                doc => doc.data()
              );

            historyReady = true;

            renderHistory();
          },

          e => message(
            "History: " + e.message,
            true
          )
        )
    );
  }

  // FIREBASE AUTHENTICATION

  auth.onAuthStateChanged(
    async user => {

      stopPrivate();

      authorized = Boolean(
        user &&
        user.uid === ADMIN_UID
      );

      if (user && !authorized) {

        await auth.signOut();
        return;
      }

      if (authorized) {
        listenPrivate();
      }

      render();
    }
  );

  // REMOVE ج FROM THE DISPLAY

  removeJeemFromScreen();

  // KEEP COUNTDOWN MOVING

  setInterval(render, 200);

  render();

})();
