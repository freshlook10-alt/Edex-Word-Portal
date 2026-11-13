
/*
 EDEX — GUESS THE ITEM IN THE BOX

 FULL APP.JS REPLACEMENT

 Fixes the timer input problem.
 Accepts 00:20 or 20 for twenty seconds.

 Keeps:
 - Existing Firebase project
 - Chocolate stock
 - WON and FAILED
 - All previous records
 - Reset Session
 - CSV exports
 - Visitor/Organizer screen
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const isAdmin = Boolean($("adminContent"));

  const liveRef =
    db.collection("wordPortal").doc("live");

  const settingsRef =
    db.collection("wordSettings").doc("main");

  const statsRef =
    db.collection("wordStats").doc("total");

  const historyRef =
    db.collection("wordHistory");

  const FV = firebase.firestore.FieldValue;

  let live = {
    stage: "idle",
    roundId: 0,
    durationSec: 120
  };

  let settings = {
    durationSec: 120
  };

  let stats = {};
  let history = [];

  let authorized = false;
  let busy = false;
  let hasStats = false;
  let hasHistory = false;
  let privateListeners = [];
  let messageTimer = null;
  let durationEdited = false;

  // FORMAT SECONDS AS MM:SS

  function formatTime(value) {
    const n = Math.max(
      0,
      Math.ceil(Number(value) || 0)
    );

    return (
      String(Math.floor(n / 60)).padStart(2, "0") +
      ":" +
      String(n % 60).padStart(2, "0")
    );
  }

  // ACCEPT 00:20 OR PLAIN 20

  function parseTime(value) {
    const text = String(value).trim();

    let n;

    if (/^\d{1,2}:[0-5]\d$/.test(text)) {
      const parts = text.split(":").map(Number);
      n = parts[0] * 60 + parts[1];

    } else if (/^\d{1,3}$/.test(text)) {
      n = Number(text);

    } else {
      throw Error(
        "Enter 00:20 or 20 for twenty seconds."
      );
    }

    if (
      !Number.isSafeInteger(n) ||
      n < 10 ||
      n > 900
    ) {
      throw Error(
        "Choose a time from 00:10 to 15:00."
      );
    }

    return n;
  }

  // GET CURRENT DURATION

  function duration() {
    const n = live.stage === "running"
      ? Number(live.durationSec)
      : Number(
          settings.durationSec ||
          live.durationSec
        );

    return Number.isFinite(n) && n >= 10
      ? n
      : 120;
  }

  // CALCULATE TIME REMAINING

  function remaining() {
    if (
      live.stage !== "running" ||
      !live.startedAt?.toMillis
    ) {
      return duration();
    }

    const end =
      live.startedAt.toMillis() +
      duration() * 1000;

    return Math.max(
      0,
      (end - Date.now()) / 1000
    );
  }

  // CURRENT GAME STATE

  function stage() {
    if (live.stage === "running") {
      return remaining() <= 0
        ? "expired"
        : "running";
    }

    return "idle";
  }

  // SHOW STATUS MESSAGE

  function showMessage(text, bad = false) {
    const el = $("actionMessage");

    if (!el) return;

    el.textContent = text;

    el.style.color = bad
      ? "#ff9bad"
      : "#b9f1dc";

    if (!isAdmin) {
      clearTimeout(messageTimer);

      messageTimer = setTimeout(() => {
        if (el.textContent === text) {
          el.textContent = "";
        }
      }, 5000);
    }
  }

  /*
    IMPORTANT TIMER FIX

    The previous code refreshed the screen
    BEFORE reading durationInput.

    That replaced 00:20 with the old timer.

    This version reads and saves the input
    before refreshing.
  */

  async function perform(task) {
    if (!authorized || busy) return;

    busy = true;

    try {
      await task();

    } catch (err) {
      console.error(err);

      showMessage(
        err?.message || "Operation failed.",
        true
      );

    } finally {
      busy = false;
      render();
    }
  }

  // SESSION COUNTERS

  function sessionCount(key) {
    const baselineKey =
      "baseline" +
      key[0].toUpperCase() +
      key.slice(1);

    return Math.max(
      0,
      Number(stats[key] || 0) -
      Number(stats[baselineKey] || 0)
    );
  }

  function sessionStart() {
    return (
      stats.sessionResetAt?.toMillis?.() ||
      0
    );
  }

  function belongsToSession(record) {
    const start = sessionStart();

    return !start ||
      (record.at?.toMillis?.() || 0) > start;
  }

  // DATE DISPLAY

  function dateText(value) {
    return value?.toDate
      ? value.toDate().toLocaleString(
          "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short"
          }
        )
      : "Saving…";
  }

  // DRAW CURRENT PAGE

  function render() {
    if (isAdmin) {
      renderAdmin();
    } else {
      renderVisitor();
    }
  }

  // VISITOR / ORGANIZER SCREEN

  function renderVisitor() {
    const s = stage();
    const left = remaining();

    $("timeText").textContent =
      formatTime(left);

    $("statusText").textContent =
      s === "running"
        ? "GUESS NOW"
        : s === "expired"
          ? "TIME IS UP"
          : "READY";

    $("roundLabel").textContent =
      "ROUND " + (live.roundId || 0);

    $("subtitle").textContent =
      s === "running"
        ? "Feel the item and guess before time runs out!"
        : s === "expired"
          ? "Time is up. Ask the organizer to record the result."
          : "No looking! Reach inside the box and guess the mystery item.";

    $("clock").classList.toggle(
      "expired",
      s === "expired"
    );

    // CIRCULAR TIMER

    const circle = $("progress");

    const circumference =
      2 * Math.PI * 109;

    circle.style.strokeDasharray =
      String(circumference);

    circle.style.strokeDashoffset =
      String(
        circumference *
        (
          1 -
          Math.max(
            0,
            Math.min(1, left / duration())
          )
        )
      );

    // ORGANIZER BUTTONS

    $("startBtn").disabled =
      busy ||
      !authorized ||
      s !== "idle";

    $("winBtn").disabled =
      busy ||
      !authorized ||
      s !== "running";

    $("failBtn").disabled =
      busy ||
      !authorized ||
      !["running", "expired"].includes(s);

    $("resetRoundBtn").disabled =
      busy ||
      !authorized ||
      s === "idle";

    $("operatorControls").hidden =
      !authorized;

    $("access").hidden =
      authorized;

    $("signedIn").hidden =
      !authorized;
  }

  // ADMIN DASHBOARD

  function renderAdmin() {
    if (!authorized) return;

    for (const field of [
      "played",
      "wins",
      "losses",
      "chocolates"
    ]) {
      $(field).textContent =
        sessionCount(field).toLocaleString();
    }

    // CHOCOLATE INVENTORY

    const total = stats.stockTotal;

    const tracked =
      Number.isSafeInteger(total) &&
      total >= 0;

    $("stock").textContent = tracked
      ? total.toLocaleString()
      : "Not set";

    $("remainingStock").textContent =
      tracked
        ? Math.max(
            0,
            total -
            Number(stats.chocolates || 0)
          ).toLocaleString()
        : "Not set";

    // TIMER

    const s = stage();

    $("adminTimer").textContent =
      formatTime(remaining());

    $("adminStage").textContent =
      s.toUpperCase();

    $("startBtn").disabled =
      busy || s !== "idle";

    $("winBtn").disabled =
      busy || s !== "running";

    $("failBtn").disabled =
      busy ||
      !["running", "expired"].includes(s);

    $("resetRoundBtn").disabled =
      busy || s === "idle";

    document.querySelectorAll(
      ".private-action"
    ).forEach(button => {
      button.disabled = busy;
    });

    /*
      SECOND TIMER FIX

      Never overwrite a duration while the
      organizer is editing it.
    */

    const input = $("durationInput");

    if (
      input &&
      !durationEdited &&
      document.activeElement !== input
    ) {
      input.value = formatTime(
        settings.durationSec || 120
      );
    }
  }

  // HISTORY TABLE

  function renderHistory() {
    if (!isAdmin || !authorized) return;

    const body = $("records");
    body.replaceChildren();

    const visible =
      history.filter(belongsToSession);

    if (!visible.length) {
      const row = body.insertRow();
      const cell = row.insertCell();

      cell.colSpan = 5;

      cell.textContent =
        "No rounds in this session.";

      return;
    }

    for (const record of visible) {
      const row = body.insertRow();

      const name =
        record.gameType === "guess-box"
          ? "Mystery Item"
          : record.word || "Earlier Ball Game";

      const values = [
        dateText(record.at),
        name,
        record.outcome === "won"
          ? "WON"
          : "FAILED",
        record.chocolate || 0,
        formatTime(record.elapsedSec || 0)
      ];

      values.forEach(value => {
        row.insertCell().textContent =
          String(value);
      });
    }
  }

  // START NEXT ROUND

  async function startRound() {
    await db.runTransaction(async tx => {
      const [liveSnap, settingsSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(settingsRef)
        ]);

      const current =
        liveSnap.data() || {};

      if (current.stage === "running") {
        throw Error(
          "Finish or cancel the current round first."
        );
      }

      const seconds =
        Number(
          settingsSnap.data()?.durationSec ||
          120
        );

      if (
        !Number.isSafeInteger(seconds) ||
        seconds < 10 ||
        seconds > 900
      ) {
        throw Error(
          "Save a valid timer setting first."
        );
      }

      tx.set(liveRef, {
        stage: "running",

        roundId:
          Number(current.roundId || 0) + 1,

        durationSec: seconds,

        startedAt:
          FV.serverTimestamp(),

        word: "",

        gameType: "guess-box"

      }, {merge: true});
    });

    showMessage("Timer started!");
  }

  // SAVE WON OR FAILED

  async function finishRound(won) {
    const newRecord = historyRef.doc();

    await db.runTransaction(async tx => {
      const [liveSnap, statsSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      const round =
        liveSnap.data() || {};

      if (
        round.stage !== "running" ||
        !round.startedAt?.toMillis
      ) {
        throw Error(
          "There is no active round."
        );
      }

      const seconds =
        Number(round.durationSec || 120);

      const elapsed =
        (
          Date.now() -
          round.startedAt.toMillis()
        ) / 1000;

      if (won && elapsed >= seconds) {
        throw Error(
          "Time is up. Choose FAILED."
        );
      }

      const savedStats =
        statsSnap.data() || {};

      if (
        won &&
        Number.isSafeInteger(
          savedStats.stockTotal
        ) &&
        Number(savedStats.chocolates || 0) >=
          savedStats.stockTotal
      ) {
        throw Error(
          "No chocolates left in this game's stock."
        );
      }

      // SAVE HISTORY

      tx.set(newRecord, {
        gameType: "guess-box",
        itemLabel: "Mystery Item",
        word: "",
        roundId: round.roundId,

        outcome:
          won ? "won" : "lost",

        chocolate:
          won ? 1 : 0,

        durationSec: seconds,

        elapsedSec:
          Math.max(
            0,
            Math.min(
              seconds,
              Math.round(elapsed)
            )
          ),

        at: FV.serverTimestamp()
      });

      // UPDATE LIFETIME COUNTERS

      tx.set(statsRef, {
        played: FV.increment(1),

        wins:
          FV.increment(won ? 1 : 0),

        losses:
          FV.increment(won ? 0 : 1),

        chocolates:
          FV.increment(won ? 1 : 0)

      }, {merge: true});

      // RESET LIVE ROUND

      tx.set(liveRef, {
        stage: "idle",
        startedAt: null,
        word: ""

      }, {merge: true});
    });

    showMessage(
      won
        ? "🍫 WON! One chocolate recorded."
        : "FAILED. No chocolate recorded."
    );
  }

  // CANCEL CURRENT ROUND

  async function resetRound() {
    if (!confirm(
      "Cancel this round without recording a result?"
    )) {
      return;
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(liveRef);

      if (
        !["running", "ready"].includes(
          snap.data()?.stage
        )
      ) {
        return;
      }

      tx.set(liveRef, {
        stage: "idle",
        startedAt: null,
        word: ""

      }, {merge: true});
    });

    showMessage(
      "Round cancelled. No chocolate counted."
    );
  }

  // FIXED SAVE TIMER FUNCTION

  async function saveDuration() {
    const input = $("durationInput");

    // READ NEW TIME BEFORE SCREEN REFRESH

    const requested =
      parseTime(input.value);

    await settingsRef.set({
      durationSec: requested

    }, {merge: true});

    settings.durationSec = requested;
    durationEdited = false;

    input.value =
      formatTime(requested);

    showMessage(
      "✅ Timer saved: " +
      formatTime(requested) +
      " (" + requested + " seconds)."
    );
  }

  // SAVE CHOCOLATE STOCK

  async function saveStock() {
    const raw =
      $("stockInput").value.trim();

    const total = Number(raw);

    if (
      !raw ||
      !Number.isSafeInteger(total) ||
      total < 0
    ) {
      throw Error(
        "Enter a whole number of chocolates."
      );
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(statsRef);

      const alreadyGiven =
        Number(
          snap.data()?.chocolates || 0
        );

      if (total < alreadyGiven) {
        throw Error(
          "Total stock cannot be less than " +
          alreadyGiven +
          " chocolates already given."
        );
      }

      tx.set(statsRef, {
        stockTotal: total
      }, {merge: true});
    });

    $("stockInput").value = "";

    showMessage(
      "Stock saved. Earlier chocolate awards remain counted."
    );
  }

  // RESET SESSION WITHOUT DELETING HISTORY

  async function resetSession() {
    if (!hasStats || !hasHistory) {
      throw Error(
        "Wait until statistics and history finish loading."
      );
    }

    if (!confirm(
      "Start a new Box Game session?\n\n" +
      "The displayed counts will start at zero.\n" +
      "All previous records and chocolates " +
      "already given will remain saved."
    )) {
      return;
    }

    await db.runTransaction(async tx => {
      const [liveSnap, statsSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      if (
        liveSnap.data()?.stage === "running"
      ) {
        throw Error(
          "Finish or cancel the active round first."
        );
      }

      const current =
        statsSnap.data() || {};

      tx.set(statsRef, {
        baselinePlayed:
          Number(current.played || 0),

        baselineWins:
          Number(current.wins || 0),

        baselineLosses:
          Number(current.losses || 0),

        baselineChocolates:
          Number(current.chocolates || 0),

        sessionResetAt:
          FV.serverTimestamp()

      }, {merge: true});
    });

    showMessage(
      "Session reset. Previous history and chocolate stock preserved."
    );
  }

  // CSV FORMATTING

  function csvCell(value) {
    let text = String(value ?? "");

    if (/^\s*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' +
      text.replaceAll('"', '""') +
      '"';
  }

  // EXPORT ALL RECORDS OR CURRENT SESSION

  async function exportCSV(allHistory) {
    const snap =
      await historyRef
        .orderBy("at", "desc")
        .get();

    const records =
      snap.docs
        .map(doc => doc.data())
        .filter(record =>
          allHistory ||
          belongsToSession(record)
        );

    const rows = [[
      "Date",
      "Game",
      "Item or word",
      "Round",
      "Result",
      "Chocolates",
      "Time used seconds"
    ]];

    for (const record of records) {
      rows.push([
        record.at?.toDate?.().toISOString() || "",

        record.gameType === "guess-box"
          ? "Guess the Item in the Box"
          : "Earlier Ball Game",

        record.gameType === "guess-box"
          ? "Mystery Item"
          : record.word || "",

        record.roundId || "",
        record.outcome || "",
        record.chocolate || 0,
        record.elapsedSec || 0
      ]);
    }

    const csv = "\uFEFF" +
      rows.map(row =>
        row.map(csvCell).join(",")
      ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8"
      })
    );

    const link =
      document.createElement("a");

    link.href = url;

    link.download = allHistory
      ? "edex-box-all-history.csv"
      : "edex-box-session.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    showMessage("CSV exported.");
  }

  // DATABASE LISTENERS

  function stopPrivate() {
    privateListeners.forEach(
      unsubscribe => unsubscribe()
    );

    privateListeners = [];
  }

  function watchPrivate() {
    privateListeners.push(
      settingsRef.onSnapshot(
        snap => {
          settings = {
            durationSec: 120,
            ...(snap.data() || {})
          };

          render();
        },

        err => showMessage(
          err.message,
          true
        )
      )
    );

    if (!isAdmin) return;

    privateListeners.push(
      statsRef.onSnapshot(
        snap => {
          stats = snap.data() || {};
          hasStats = true;

          render();
          renderHistory();
        },

        err => showMessage(
          err.message,
          true
        )
      )
    );

    privateListeners.push(
      historyRef
        .orderBy("at", "desc")
        .limit(200)
        .onSnapshot(
          snap => {
            history = snap.docs.map(
              doc => doc.data()
            );

            hasHistory = true;

            render();
            renderHistory();
          },

          err => showMessage(
            err.message,
            true
          )
        )
    );
  }

  // CONNECT BUTTONS

  function bind(id, task) {
    if ($(id)) {
      $(id).addEventListener(
        "click",
        () => perform(task)
      );
    }
  }

  bind("startBtn", startRound);

  bind(
    "winBtn",
    () => finishRound(true)
  );

  bind(
    "failBtn",
    () => finishRound(false)
  );

  bind(
    "resetRoundBtn",
    resetRound
  );

  if (isAdmin) {
    // REMEMBER THE VALUE BEING TYPED

    $("durationInput").addEventListener(
      "input",
      () => {
        durationEdited = true;
      }
    );

    bind(
      "saveDurationBtn",
      saveDuration
    );

    bind(
      "stockBtn",
      saveStock
    );

    bind(
      "resetSession",
      resetSession
    );

    bind(
      "csv",
      () => exportCSV(false)
    );

    bind(
      "csvAll",
      () => exportCSV(true)
    );
  }

  // ORGANIZER LOGIN

  $("loginForm").addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      $("loginError").textContent = "";

      try {
        const credentials =
          await auth.signInWithEmailAndPassword(
            $("email").value.trim(),
            $("password").value
          );

        if (
          credentials.user.uid !== ADMIN_UID
        ) {
          await auth.signOut();

          throw Error(
            "This is not the organizer account."
          );
        }

        $("password").value = "";

      } catch (err) {
        $("loginError").textContent =
          err?.message || "Login failed.";
      }
    }
  );

  // SIGN OUT

  const signout =
    $("signout") || $("signOutBtn");

  if (signout) {
    signout.onclick = () => {
      if (!busy) {
        auth.signOut();
      }
    };
  }

  // FIREBASE AUTH STATE

  auth.onAuthStateChanged(async user => {
    authorized =
      Boolean(
        user &&
        user.uid === ADMIN_UID
      );

    stopPrivate();

    if (user && !authorized) {
      await auth.signOut();
      return;
    }

    if (authorized) {
      watchPrivate();
    }

    if (isAdmin) {
      $("adminLogin").hidden =
        authorized;

      $("adminContent").hidden =
        !authorized;

    } else {
      $("operatorControls").hidden =
        !authorized;

      $("access").hidden =
        authorized;

      $("signedIn").hidden =
        !authorized;
    }

    render();
  });

  // SYNCHRONIZED LIVE GAME

  liveRef.onSnapshot(
    snap => {
      live = {
        stage: "idle",
        roundId: 0,
        durationSec: 120,
        ...(snap.data() || {})
      };

      if ($("connection")) {
        $("connection").textContent =
          "● LIVE";
      }

      render();
    },

    err => {
      if ($("connection")) {
        $("connection").textContent =
          "● OFFLINE";
      }

      showMessage(
        err.message,
        true
      );
    }
  );

  // UPDATE LIVE CLOCK

  setInterval(render, 200);

  render();

})();
