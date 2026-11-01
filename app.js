
/*
 EDEX WORD PORTAL
 Randomizer + Timer + Chocolate Records
 One shared visitor/organizer screen
 Separate private admin dashboard
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const isAdminPage = Boolean($("adminContent"));

  // FIVE ARABIC LETTERS
  const letters = [..."ابتثج"];

  // ALL 125 POSSIBLE THREE-LETTER COMBINATIONS
  // 5 x 5 x 5 = 125
  // Some combinations are not actual Arabic words.
  const allCombinations = letters.flatMap(a =>
    letters.flatMap(b =>
      letters.map(c => a + b + c)
    )
  );

  // STARTER BANK OF ACTUAL ARABIC WORD FORMS
  // You can edit and expand this from Admin.
  const starterWords = [
    "باب", "بات", "تاب", "تاج", "جاب",
    "ثاب", "جثا", "ثبت", "بثت", "تبت",
    "جبت", "جثث", "تجب", "تبث", "تثب"
  ];

  const initialSettings = {
    mode: "words",
    durationSec: 120,
    words: starterWords
  };

  const emptyRound = {
    stage: "idle",
    word: "",
    roundId: 0,
    durationSec: 120,
    startedAt: null,
    usedWords: []
  };

  // FIRESTORE DATABASE LOCATIONS
  const liveRef = db.collection("wordPortal")
                    .doc("live");

  const settingsRef = db.collection("wordSettings")
                        .doc("main");

  const statsRef = db.collection("wordStats")
                     .doc("total");

  const historyRef = db.collection("wordHistory");

  const add = firebase.firestore.FieldValue;

  let live = {...emptyRound};
  let settings = {...initialSettings};

  let stats = {
    played: 0,
    wins: 0,
    losses: 0,
    chocolates: 0,
    stockTotal: null
  };

  let history = [];
  let authorized = false;
  let busy = false;
  let previousWord = null;
  let privateUnsubscribers = [];
  let toastTimeout;

  // FORMAT SECONDS AS MM:SS
  const secondsText = seconds => {
    const s = Math.max(0, Math.ceil(seconds));

    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  };

  const roundDuration = () =>
    Number(live.durationSec) || 120;

  // CALCULATE REMAINING TIME
  const remaining = () => {
    if (live.stage === "idle") {
      return Number(settings.durationSec) || 120;
    }

    if (live.stage === "ready") {
      return roundDuration();
    }

    if (live.stage === "running") {
      if (!live.startedAt?.toMillis) {
        return roundDuration();
      }

      return Math.max(
        0,
        (
          live.startedAt.toMillis() +
          roundDuration() * 1000 -
          Date.now()
        ) / 1000
      );
    }

    return 0;
  };

  const currentStage = () =>
    live.stage === "running" &&
    live.startedAt?.toMillis &&
    remaining() <= 0
      ? "expired"
      : live.stage;

  const failMessage = error =>
    error?.message ||
    "Unable to save. Check your connection.";

  // REMOVE DUPLICATE WORDS FROM THE EDITABLE BANK
  const uniqueWords = raw =>
    [...new Set(
      raw.split(/[\s,،؛;]+/u)
         .map(w => w.trim())
         .filter(Boolean)
    )];

  // NOTIFICATION
  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      el.classList.remove("show");
    }, 3200);
  }

  // PREVENT DOUBLE-CLICK ACTIONS
  async function perform(task) {
    if (!authorized || busy) return;

    busy = true;
    render();

    try {
      await task();
    } catch (error) {
      toast(failMessage(error));
    } finally {
      busy = false;
      render();
    }
  }

  // MAIN VISITOR AND ORGANIZER SCREEN
  function renderGame() {
    const stage = currentStage();
    const seconds = remaining();

    const full = stage === "idle"
      ? Number(settings.durationSec) || 120
      : roundDuration();

    $("time").textContent = secondsText(seconds);

    // UPDATE CIRCULAR TIMER
    $("ring").style.strokeDashoffset = String(
      552.92 * (
        1 - Math.min(1, seconds / full)
      )
    );

    $("timer").classList.toggle(
      "warning",
      stage === "running" && seconds <= 15
    );

    $("timer").classList.toggle(
      "expired",
      stage === "expired"
    );

    $("phase").textContent = ({
      idle: "STANDBY",
      ready: "READY TO START",
      running: "TIME REMAINING",
      expired: "TIME IS UP"
    })[stage] || "STANDBY";

    $("prompt").textContent = ({
      idle: "A new challenge awaits.",
      ready: "Your challenge has been revealed.",
      running: "The countdown is on!",
      expired: "Time has run out."
    })[stage] || "A new challenge awaits.";

    $("message").textContent = ({
      idle: "THE NEXT WORD IS WAITING",
      ready: "READY WHEN YOU ARE",
      running: "MAKE EVERY SECOND COUNT",
      expired: "CHALLENGE ENDED"
    })[stage] || "THE NEXT WORD IS WAITING";

    // DISPLAY ARABIC LETTERS
    if (previousWord !== live.word) {
      previousWord = live.word;

      const holder = $("word");
      holder.replaceChildren();

      if (live.word) {
        for (const letter of [...live.word]) {
          const tile = document.createElement("span");
          tile.textContent = letter;
          holder.append(tile);
        }
      } else {
        holder.textContent = "✦";
      }
    }

    // SHOW ORGANIZER BUTTONS AFTER LOGIN
    $("operator").hidden = !authorized;
    $("access").hidden = authorized;

    $("randomBtn").disabled =
      busy || stage !== "idle";

    $("startBtn").disabled =
      busy || stage !== "ready";

    $("winBtn").disabled =
      busy || stage !== "running";

    // AVAILABLE EVEN AFTER TIMER EXPIRES
    $("loseBtn").disabled =
      busy ||
      !["running", "expired"].includes(stage);

    $("saveTime").disabled = busy;

    $("controlStatus").textContent =
      stage.toUpperCase();

    const pool = settings.mode === "all"
      ? allCombinations
      : settings.words;

    const seen = new Set(live.usedWords || []);

    $("usedCount").textContent =
      pool.filter(w => seen.has(w)).length +
      " / " + pool.length + " used";
  }

  // PRIVATE ADMIN DASHBOARD
  function renderDashboard() {
    if (!authorized) return;

    for (const id of [
      "played", "wins", "losses", "chocolates"
    ]) {
      $(id).textContent =
        Number(stats[id] || 0).toLocaleString();
    }

    const hasStock =
      Number.isSafeInteger(stats.stockTotal);

    $("stock").textContent = hasStock
      ? stats.stockTotal.toLocaleString()
      : "—";

    $("remainingStock").textContent = hasStock
      ? Math.max(
          0,
          stats.stockTotal -
          Number(stats.chocolates || 0)
        ).toLocaleString()
      : "—";

    const table = $("records");
    table.replaceChildren();

    if (!history.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");

      td.colSpan = 5;
      td.textContent = "No completed rounds yet.";

      tr.append(td);
      table.append(tr);
    }

    for (const record of history) {
      const tr = document.createElement("tr");

      const values = [
        record.at?.toDate?.().toLocaleString()
          || "Saving...",

        record.word || "—",

        record.outcome === "won"
          ? "Completed"
          : "Not Won",

        String(record.chocolate || 0),

        secondsText(record.elapsedSec || 0)
      ];

      values.forEach((value, index) => {
        const td = document.createElement("td");

        td.textContent = value;

        if (index === 1) {
          td.className = "arabic";
        }

        tr.append(td);
      });

      table.append(tr);
    }
  }

  function render() {
    if (isAdminPage) {
      renderDashboard();
    } else {
      renderGame();
    }
  }

  // RANDOMIZE A WORD WITHOUT REPEATING
  async function randomizeWord() {
    await db.runTransaction(async tx => {
      const liveSnap = await tx.get(liveRef);
      const settingsSnap = await tx.get(settingsRef);

      const current = {
        ...emptyRound,
        ...(liveSnap.data() || {})
      };

      const cfg = {
        ...initialSettings,
        ...(settingsSnap.data() || {})
      };

      if (current.stage !== "idle") {
        throw Error("Finish this round first.");
      }

      const pool = cfg.mode === "all"
        ? allCombinations
        : cfg.words;

      const used =
        new Set(current.usedWords || []);

      const available = pool.filter(
        word => !used.has(word)
      );

      if (!available.length) {
        throw Error(
          "No unused words left. Reset the word cycle in Admin."
        );
      }

      const picked = available[
        Math.floor(Math.random() * available.length)
      ];

      tx.set(liveRef, {
        stage: "ready",
        word: picked,
        durationSec: Number(cfg.durationSec) || 120,
        roundId: Number(current.roundId || 0) + 1,
        usedWords: [...used, picked],
        startedAt: null
      }, {merge: true});
    });
  }

  // START THE COUNTDOWN
  async function startRound() {
    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);

      if (
        !snap.exists ||
        snap.data().stage !== "ready"
      ) {
        throw Error("Choose a random word first.");
      }

      tx.update(liveRef, {
        stage: "running",
        startedAt: add.serverTimestamp()
      });
    });
  }

  // COMPLETE A ROUND AND RECORD THE CHOCOLATE
  async function finishRound(won) {
    const recordRef = historyRef.doc();

    await db.runTransaction(async tx => {
      const liveSnap = await tx.get(liveRef);
      const statsSnap = await tx.get(statsRef);

      const round = liveSnap.data();

      if (
        round?.stage !== "running" ||
        !round.startedAt?.toMillis
      ) {
        throw Error(
          "There is no active round to finish."
        );
      }

      const elapsed =
        (
          Date.now() -
          round.startedAt.toMillis()
        ) / 1000;

      if (won && elapsed >= round.durationSec) {
        throw Error(
          "Time is up. Select Not Won — No Chocolate."
        );
      }

      const existing = statsSnap.data() || {};

      // CHECK CHOCOLATE STOCK
      if (
        won &&
        Number.isSafeInteger(existing.stockTotal) &&
        Number(existing.chocolates || 0) >=
        existing.stockTotal
      ) {
        throw Error(
          "No chocolate stock left. Update stock in Admin."
        );
      }

      // SAVE THE ROUND IN FIRESTORE
      tx.set(recordRef, {
        roundId: round.roundId,
        word: round.word,
        outcome: won ? "won" : "lost",
        chocolate: won ? 1 : 0,
        durationSec: round.durationSec,

        elapsedSec: Math.min(
          round.durationSec,
          Math.max(0, Math.round(elapsed))
        ),

        at: add.serverTimestamp()
      });

      // UPDATE CHOCOLATE TOTALS
      tx.set(statsRef, {
        played: add.increment(1),
        wins: add.increment(won ? 1 : 0),
        losses: add.increment(won ? 0 : 1),
        chocolates: add.increment(won ? 1 : 0)
      }, {merge: true});

      // AUTOMATICALLY CLEAR THE GAME SCREEN
      // DO NOT CLEAR SAVED COUNTS
      tx.set(liveRef, {
        stage: "idle",
        word: "",
        startedAt: null
      }, {merge: true});
    });

    if (won) {
      toast(
        "🍫 Chocolate recorded. Ready for the next visitor!"
      );
    } else {
      toast(
        "No chocolate recorded. Ready for the next visitor!"
      );
    }
  }

  // SET THE SAME TIMER FOR FUTURE ROUNDS
  async function saveTime() {
    const input = $("minutes").value.trim();
    const minutes = Number(input);

    if (
      !input ||
      !Number.isFinite(minutes) ||
      minutes < 0.25 ||
      minutes > 15
    ) {
      throw Error(
        "Enter a time between 0.25 and 15 minutes."
      );
    }

    await settingsRef.set({
      durationSec: Math.round(minutes * 60)
    }, {merge: true});

    toast("Timer saved for every future round.");
  }

  // SAVE THE ADMIN WORD BANK
  async function saveWords() {
    const words =
      uniqueWords($("wordList").value);

    if (
      !words.length ||
      words.some(w => !/^[ابتثج]{3}$/u.test(w))
    ) {
      throw Error(
        "Every entry must have exactly three letters from ا ب ت ث ج."
      );
    }

    await settingsRef.set({
      mode: $("mode").value,
      words
    }, {merge: true});

    toast("Word bank saved.");
  }

  // RESET ONLY THE WORD CYCLE
  async function resetWords() {
    if (!confirm(
      "Allow previous words again? Chocolate totals will NOT reset."
    )) {
      return;
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);

      if (
        snap.exists &&
        snap.data().stage !== "idle"
      ) {
        throw Error(
          "Finish the current round before resetting words."
        );
      }

      tx.set(liveRef, {
        usedWords: []
      }, {merge: true});
    });

    toast("Word cycle reset.");
  }

  // CHOCOLATE INVENTORY
  async function saveStock() {
    const input = $("stockInput").value.trim();
    const quantity = Number(input);

    if (
      !input ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0
    ) {
      throw Error(
        "Enter a valid whole number for total chocolate stock."
      );
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(statsRef);

      if (
        quantity <
        Number(snap.data()?.chocolates || 0)
      ) {
        throw Error(
          "Total stock cannot be less than chocolates already distributed."
        );
      }

      tx.set(statsRef, {
        stockTotal: quantity
      }, {merge: true});
    });

    toast("Chocolate stock saved.");
  }

  // DOWNLOAD ADMIN RESULTS AS CSV
  async function exportCSV() {
    const snap = await historyRef
      .orderBy("at", "desc")
      .get();

    const rows = [[
      "Date",
      "Word",
      "Result",
      "Chocolates",
      "Time Used (Seconds)"
    ]];

    snap.docs.forEach(doc => {
      const r = doc.data();

      rows.push([
        r.at?.toDate?.().toISOString() || "",
        r.word || "",
        r.outcome || "",
        r.chocolate || 0,
        r.elapsedSec || 0
      ]);
    });

    const csv = "\ufeff" +
      rows.map(row =>
        row.map(x =>
          '"' +
          String(x).replace(/"/g, '""') +
          '"'
        ).join(",")
      ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8"
      })
    );

    const a = document.createElement("a");

    a.href = url;
    a.download = "edex-word-portal-results.csv";

    document.body.append(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  // LIVE FIREBASE LISTENERS
  function stopPrivateListeners() {
    privateUnsubscribers.forEach(
      unsubscribe => unsubscribe()
    );

    privateUnsubscribers = [];
  }

  function startPrivateListeners() {
    privateUnsubscribers.push(
      settingsRef.onSnapshot(snap => {
        settings = {
          ...initialSettings,
          ...(snap.data() || {})
        };

        if (isAdminPage) {
          $("mode").value = settings.mode;

          $("wordList").value =
            settings.words.join("، ");
        } else {
          $("minutes").value =
            String(settings.durationSec / 60);
        }

        render();
      }, error => toast(failMessage(error)))
    );

    if (isAdminPage) {
      // LISTEN FOR CHOCOLATE TOTALS
      privateUnsubscribers.push(
        statsRef.onSnapshot(snap => {
          stats = {
            ...stats,
            ...(snap.data() || {})
          };

          render();
        }, error => toast(failMessage(error)))
      );

      // LISTEN FOR RECENT ROUNDS
      privateUnsubscribers.push(
        historyRef
          .orderBy("at", "desc")
          .limit(200)
          .onSnapshot(snap => {
            history = snap.docs.map(
              doc => doc.data()
            );

            render();
          }, error => toast(failMessage(error)))
      );
    }
  }

  // BUTTONS ON THE SHARED SCREEN
  if (!isAdminPage) {
    liveRef.onSnapshot(snap => {
      live = {
        ...emptyRound,
        ...(snap.data() || {})
      };

      $("connection").textContent = "● LIVE";
      render();

    }, error => {
      $("connection").textContent =
        "● CONNECTION ERROR";

      toast(failMessage(error));
    });

    // UPDATE TIMER FIVE TIMES PER SECOND
    setInterval(renderGame, 200);

    $("randomBtn").onclick = () =>
      perform(randomizeWord);

    $("startBtn").onclick = () =>
      perform(startRound);

    $("winBtn").onclick = () =>
      perform(() => finishRound(true));

    $("loseBtn").onclick = () =>
      perform(() => finishRound(false));

    $("saveTime").onclick = () =>
      perform(saveTime);

  } else {
    // BUTTONS ON THE ADMIN PAGE
    $("stockBtn").onclick = () =>
      perform(saveStock);

    $("saveBank").onclick = () =>
      perform(saveWords);

    $("resetCycle").onclick = () =>
      perform(resetWords);

    $("csv").onclick = () =>
      perform(exportCSV);
  }

  // ORGANIZER LOGIN
  $("loginForm").addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      $("loginError").textContent = "";

      try {
        const credential =
          await auth.signInWithEmailAndPassword(
            $("email").value.trim(),
            $("password").value
          );

        // ALLOW ONLY THE AUTHORIZED ORGANIZER
        if (credential.user.uid !== ADMIN_UID) {
          await auth.signOut();

          throw Error(
            "This user is not the organizer account."
          );
        }

        $("password").value = "";

      } catch (error) {
        $("loginError").textContent =
          failMessage(error);
      }
    }
  );

  // SIGN OUT
  $("signout").onclick = () =>
    auth.signOut();

  // CHECK ORGANIZER LOGIN STATUS
  auth.onAuthStateChanged(async user => {
    const allowed = Boolean(
      user && user.uid === ADMIN_UID
    );

    authorized = allowed;

    stopPrivateListeners();

    if (user && !allowed) {
      toast("This account is not authorized.");

      await auth.signOut();
      return;
    }

    if (allowed) {
      startPrivateListeners();
    }

    if (isAdminPage) {
      $("adminLogin").hidden = allowed;
      $("adminContent").hidden = !allowed;
    }

    render();
  });

  render();

})();
