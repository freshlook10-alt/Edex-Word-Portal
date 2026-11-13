
/*
 EDEX — GUESS THE ITEM IN THE BOX

 FULL APP.JS REPLACEMENT

 Timer accepts 00:20 or 20.
 Keeps Firebase data, chocolates,
 history, CSV and Reset Session.
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const isAdmin = Boolean($("adminContent"));

  const FV = firebase.firestore.FieldValue;

  const liveRef =
    db.collection("wordPortal").doc("live");

  const settingsRef =
    db.collection("wordSettings").doc("main");

  const statsRef =
    db.collection("wordStats").doc("total");

  const historyRef =
    db.collection("wordHistory");

  let authorized = false;
  let busy = false;

  let durationDirty = false;
  let settingsKnown = false;

  let statsReady = false;
  let historyReady = false;

  let live = {
    stage: "idle",
    durationSec: 120,
    roundId: 0
  };

  let settings = {
    durationSec: 120
  };

  let stats = {};
  let history = [];
  let unsubs = [];

  // FORMAT SECONDS AS MM:SS

  function clockText(value) {
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

  // ACCEPT 00:20 OR JUST 20

  function parseTime(raw) {
    const text = String(raw).trim();

    let value;

    if (/^\d{1,2}:[0-5]\d$/.test(text)) {

      const [m, s] =
        text.split(":").map(Number);

      value = m * 60 + s;

    } else if (/^\d{1,3}$/.test(text)) {

      value = Number(text);

    } else {

      throw Error(
        "Use 00:20 or 20 for twenty seconds."
      );
    }

    if (
      !Number.isSafeInteger(value) ||
      value < 10 ||
      value > 900
    ) {
      throw Error(
        "Set a duration from 00:10 to 15:00."
      );
    }

    return value;
  }

  // CONFIGURED DURATION

  function configuredSeconds() {

    const n = Number(
      settingsKnown
        ? settings.durationSec
        : live.durationSec
    );

    return Number.isFinite(n) && n >= 10
      ? n
      : 120;
  }

  // CURRENT ROUND DURATION

  function roundSeconds() {

    const n = Number(
      live.stage === "running"
        ? live.durationSec
        : configuredSeconds()
    );

    return Number.isFinite(n) && n >= 10
      ? n
      : 120;
  }

  // LIVE REMAINING TIME

  function timeLeft() {

    if (
      live.stage !== "running" ||
      !live.startedAt?.toMillis
    ) {
      return roundSeconds();
    }

    const end =
      live.startedAt.toMillis() +
      roundSeconds() * 1000;

    return Math.max(
      0,
      (end - Date.now()) / 1000
    );
  }

  // GAME STAGE

  function stage() {

    if (live.stage !== "running") {
      return "idle";
    }

    return (
      live.startedAt?.toMillis &&
      timeLeft() <= 0
    )
      ? "expired"
      : "running";
  }

  // STATUS MESSAGE

  function message(text, bad = false) {

    const el = $("actionMessage");

    if (!el) return;

    el.textContent = text;

    el.style.color = bad
      ? "#ff9eae"
      : "#aff1ce";
  }

  // PROTECT EDITABLE FIELDS DURING SAVING

  async function perform(work) {

    if (!authorized || busy) return;

    busy = true;

    // Do not render here.
    // The old code overwrote the input
    // before reading its new value.

    try {

      await work();

    } catch (err) {

      console.error(
        "EDEX operation failed",
        err
      );

      message(
        err?.message ||
        "Action failed. Check Firebase permissions.",
        true
      );

    } finally {

      busy = false;

      render();
    }
  }

  // SELECT CURRENT PAGE

  function render() {
    if (isAdmin) {
      renderAdmin();
    } else {
      renderVisitor();
    }
  }

  // VISITOR / ORGANIZER PAGE

  function renderVisitor() {

    const s = stage();
    const left = timeLeft();

    $("timeText").textContent =
      clockText(left);

    $("statusText").textContent =
      s === "running"
        ? "GUESS NOW"
        : s === "expired"
          ? "TIME'S UP"
          : "READY";

    $("roundLabel").textContent =
      "ROUND " + Number(live.roundId || 0);

    $("subtitle").textContent =
      s === "running"
        ? "Feel the mystery item and guess before time runs out!"
        : s === "expired"
          ? "Time is up! The organizer records the result."
          : "No looking! Use your hands to guess what is hidden in the box.";

    $("clock").classList.toggle(
      "expired",
      s === "expired"
    );

    // CIRCULAR CLOCK

    const circumference =
      2 * Math.PI * 109;

    $("progress").style.strokeDasharray =
      String(circumference);

    $("progress").style.strokeDashoffset =
      String(
        circumference *
        (
          1 -
          Math.min(
            1,
            Math.max(
              0,
              left / roundSeconds()
            )
          )
        )
      );

    // ORGANIZER BUTTONS

    $("startBtn").disabled =
      !authorized ||
      busy ||
      s !== "idle";

    $("winBtn").disabled =
      !authorized ||
      busy ||
      s !== "running";

    $("failBtn").disabled =
      !authorized ||
      busy ||
      !["running", "expired"].includes(s);

    $("resetRoundBtn").disabled =
      !authorized ||
      busy ||
      s === "idle";

    $("operatorControls").hidden =
      !authorized;

    $("access").hidden =
      authorized;

    $("signedIn").hidden =
      !authorized;
  }

  // SESSION COUNTERS

  function sessionCount(field) {

    const baseline =
      "baseline" +
      field[0].toUpperCase() +
      field.slice(1);

    return Math.max(
      0,
      Number(stats[field] || 0) -
      Number(stats[baseline] || 0)
    );
  }

  // ADMIN DASHBOARD

  function renderAdmin() {

    if (!authorized) return;

    [
      "played",
      "wins",
      "losses",
      "chocolates"
    ].forEach(field => {

      $(field).textContent =
        sessionCount(field).toLocaleString();

    });

    // CHOCOLATE STOCK
    // USE LIFETIME AWARDS

    const stock = stats.stockTotal;

    const stockValid =
      Number.isSafeInteger(stock) &&
      stock >= 0;

    $("stock").textContent =
      stockValid
        ? stock.toLocaleString()
        : "Not set";

    $("remainingStock").textContent =
      stockValid
        ? Math.max(
            0,
            stock -
            Number(stats.chocolates || 0)
          ).toLocaleString()
        : "Not set";

    // TIMER DISPLAY

    const s = stage();

    $("adminTimer").textContent =
      clockText(timeLeft());

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
    ).forEach(el => {
      el.disabled = busy;
    });

    // IMPORTANT TIMER FIX:
    // NEVER overwrite text that the
    // organizer is currently editing.

    const input = $("durationInput");

    if (
      !durationDirty &&
      document.activeElement !== input
    ) {

      const text =
        clockText(configuredSeconds());

      if (input.value !== text) {
        input.value = text;
      }
    }
  }

  // SESSION START

  function sessionStart() {

    return (
      stats.sessionResetAt?.toMillis?.() ||
      0
    );
  }

  function belongsToSession(record) {

    const beginning = sessionStart();

    return (
      !beginning ||
      (record.at?.toMillis?.() || 0) > beginning
    );
  }

  // FORMAT DATE

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

  // RENDER ROUND HISTORY

  function renderHistory() {

    if (!isAdmin || !authorized) return;

    const body = $("records");

    body.replaceChildren();

    const visible =
      history.filter(belongsToSession);

    if (!visible.length) {

      const row = body.insertRow();

      row.insertCell().colSpan = 5;

      row.cells[0].textContent =
        "No rounds in this session.";

      return;
    }

    for (const record of visible) {

      const row = body.insertRow();

      const values = [

        dateText(record.at),

        record.gameType === "guess-box"
          ? "Mystery Item"
          : record.word || "Earlier Ball Game",

        record.outcome === "won"
          ? "WON"
          : "FAILED",

        record.chocolate || 0,

        clockText(record.elapsedSec || 0)

      ];

      values.forEach(text => {

        row.insertCell().textContent =
          String(text);

      });
    }
  }

  // SAVE TIMER
  // READ INPUT FIRST, BEFORE REFRESH

  async function saveDuration() {

    const input = $("durationInput");

    const requested =
      parseTime(input.value);

    durationDirty = true;

    // SAVE IN FIREBASE
    // ALSO UPDATE IDLE VISITOR TIMER

    await db.runTransaction(async tx => {

      const liveSnapshot =
        await tx.get(liveRef);

      tx.set(
        settingsRef,
        {
          durationSec: requested
        },
        {
          merge: true
        }
      );

      if (
        liveSnapshot.data()?.stage !== "running"
      ) {

        tx.set(
          liveRef,
          {
            durationSec: requested
          },
          {
            merge: true
          }
        );
      }
    });

    settings = {
      ...settings,
      durationSec: requested
    };

    settingsKnown = true;

    input.value =
      clockText(requested);

    durationDirty = false;

    message(
      "✅ Timer saved: " +
      clockText(requested) +
      " (" + requested + " seconds). " +
      "Use Start Timer for the next round."
    );
  }

  // START ROUND WITHOUT RANDOMIZER

  async function startRound() {

    await db.runTransaction(async tx => {

      const [liveDoc, settingDoc] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(settingsRef)
        ]);

      const current =
        liveDoc.data() || {};

      if (
        current.stage === "running"
      ) {
        throw Error(
          "Finish or cancel the current round first."
        );
      }

      const durationSec =
        Number(
          settingDoc.data()?.durationSec ||
          120
        );

      if (
        !Number.isSafeInteger(durationSec) ||
        durationSec < 10 ||
        durationSec > 900
      ) {
        throw Error(
          "Save a valid timer first. " +
          "00:20 means 20 seconds."
        );
      }

      tx.set(
        liveRef,
        {
          stage: "running",

          roundId:
            Number(current.roundId || 0) + 1,

          durationSec,

          startedAt:
            FV.serverTimestamp(),

          gameType: "guess-box",

          word: ""
        },
        {
          merge: true
        }
      );
    });

    message("Timer started!");
  }

  // WON / FAILED

  async function finishRound(won) {

    const recordRef =
      historyRef.doc();

    await db.runTransaction(async tx => {

      const [roundDoc, statDoc] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      const round =
        roundDoc.data() || {};

      if (
        round.stage !== "running" ||
        !round.startedAt?.toMillis
      ) {
        throw Error(
          "There is no active round."
        );
      }

      const totalSec =
        Number(
          round.durationSec || 120
        );

      const elapsed =
        Math.max(
          0,
          (
            Date.now() -
            round.startedAt.toMillis()
          ) / 1000
        );

      if (
        won &&
        elapsed >= totalSec
      ) {
        throw Error(
          "Time expired. Choose FAILED."
        );
      }

      const saved =
        statDoc.data() || {};

      // DO NOT AWARD MORE THAN STOCK

      if (
        won &&
        Number.isSafeInteger(saved.stockTotal) &&
        Number(saved.chocolates || 0) >=
          saved.stockTotal
      ) {
        throw Error(
          "No chocolates left in this game's stock."
        );
      }

      // SAVE HISTORICAL RESULT

      tx.set(
        recordRef,
        {
          gameType: "guess-box",

          itemLabel: "Mystery Item",

          word: "",

          roundId: round.roundId || 0,

          outcome:
            won ? "won" : "lost",

          chocolate:
            won ? 1 : 0,

          durationSec: totalSec,

          elapsedSec:
            Math.min(
              totalSec,
              Math.round(elapsed)
            ),

          at:
            FV.serverTimestamp()
        }
      );

      // UPDATE LIFETIME COUNTERS

      tx.set(
        statsRef,
        {
          played:
            FV.increment(1),

          wins:
            FV.increment(won ? 1 : 0),

          losses:
            FV.increment(won ? 0 : 1),

          chocolates:
            FV.increment(won ? 1 : 0)
        },
        {
          merge: true
        }
      );

      // RESET LIVE ROUND

      tx.set(
        liveRef,
        {
          stage: "idle",
          startedAt: null,
          word: ""
        },
        {
          merge: true
        }
      );
    });

    message(
      won
        ? "🍫 WON! One chocolate recorded."
        : "FAILED. No chocolate recorded."
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

      const snap =
        await tx.get(liveRef);

      if (
        !["running", "ready"].includes(
          snap.data()?.stage
        )
      ) {
        return;
      }

      tx.set(
        liveRef,
        {
          stage: "idle",
          startedAt: null,
          word: ""
        },
        {
          merge: true
        }
      );
    });

    message(
      "Round cancelled; no chocolate counted."
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
        "Enter a nonnegative whole number of chocolates."
      );
    }

    await db.runTransaction(async tx => {

      const snap =
        await tx.get(statsRef);

      const given =
        Number(
          snap.data()?.chocolates || 0
        );

      if (total < given) {
        throw Error(
          "Stock cannot be below " +
          given +
          " already-awarded chocolates."
        );
      }

      tx.set(
        statsRef,
        {
          stockTotal: total
        },
        {
          merge: true
        }
      );
    });

    $("stockInput").value = "";

    message(
      "Chocolate stock saved. " +
      "Past awards remain counted."
    );
  }

  // RESET SESSION ONLY
  // PRESERVE OLD RECORDS AND STOCK

  async function resetSession() {

    if (
      !statsReady ||
      !historyReady
    ) {
      throw Error(
        "Wait for Firebase history to load first."
      );
    }

    if (!confirm(
      "Start a NEW session?\n\n" +
      "Displayed counters will restart at zero.\n" +
      "Old results and chocolates already given " +
      "will remain saved."
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const [roundDoc, statDoc] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(statsRef)
        ]);

      if (
        roundDoc.data()?.stage === "running"
      ) {
        throw Error(
          "Finish or cancel the active round first."
        );
      }

      const saved =
        statDoc.data() || {};

      tx.set(
        statsRef,
        {
          baselinePlayed:
            Number(saved.played || 0),

          baselineWins:
            Number(saved.wins || 0),

          baselineLosses:
            Number(saved.losses || 0),

          baselineChocolates:
            Number(saved.chocolates || 0),

          sessionResetAt:
            FV.serverTimestamp()
        },
        {
          merge: true
        }
      );
    });

    message(
      "Session restarted. Older records " +
      "and chocolate stock preserved."
    );
  }

  // SAFE CSV FORMAT

  function csvCell(value) {

    let text =
      String(value ?? "");

    if (/^\s*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' +
      text.replaceAll('"', '""') +
      '"';
  }

  // EXPORT SESSION OR ALL HISTORY

  async function exportCSV(all) {

    const snap =
      await historyRef
        .orderBy("at", "desc")
        .get();

    const records =
      snap.docs
        .map(doc => doc.data())
        .filter(rec =>
          all ||
          belongsToSession(rec)
        );

    const lines = [[
      "Date",
      "Game",
      "Item or previous word",
      "Round",
      "Result",
      "Chocolates",
      "Time used (seconds)"
    ]];

    for (const rec of records) {

      lines.push([

        rec.at?.toDate?.().toISOString() || "",

        rec.gameType === "guess-box"
          ? "Guess the Item in the Box"
          : "Earlier Ball Game",

        rec.gameType === "guess-box"
          ? "Mystery Item"
          : rec.word || "",

        rec.roundId || "",

        rec.outcome || "",

        rec.chocolate || 0,

        rec.elapsedSec || 0

      ]);
    }

    const content = "\uFEFF" +
      lines.map(row =>
        row.map(csvCell).join(",")
      ).join("\r\n");

    const url =
      URL.createObjectURL(
        new Blob(
          [content],
          {
            type:
              "text/csv;charset=utf-8"
          }
        )
      );

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download = all
      ? "box-game-all-history.csv"
      : "box-game-session.csv";

    document.body.appendChild(anchor);

    anchor.click();
    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    message("CSV exported.");
  }

  // FIREBASE LISTENERS

  function stopPrivate() {

    unsubs.forEach(fn => fn());

    unsubs = [];
  }

  function listenPrivate() {

    // SAVED TIMER

    unsubs.push(
      settingsRef.onSnapshot(
        snap => {

          settings = {
            ...settings,
            ...(snap.data() || {})
          };

          settingsKnown = true;

          render();

        },
        err => message(
          "Settings: " + err.message,
          true
        )
      )
    );

    if (!isAdmin) return;

    // STOCK AND COUNTERS

    unsubs.push(
      statsRef.onSnapshot(
        snap => {

          stats = snap.data() || {};

          statsReady = true;

          render();
          renderHistory();

        },
        err => message(
          "Stats: " + err.message,
          true
        )
      )
    );

    // ROUND HISTORY

    unsubs.push(
      historyRef
        .orderBy("at", "desc")
        .limit(200)
        .onSnapshot(
          snap => {

            history =
              snap.docs.map(
                doc => doc.data()
              );

            historyReady = true;

            renderHistory();

          },
          err => message(
            "History: " + err.message,
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

  bind(
    "startBtn",
    startRound
  );

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
    cancelRound
  );

  // ADMIN-ONLY BUTTONS

  if (isAdmin) {

    const input =
      $("durationInput");

    // KEEP THE VALUE BEING TYPED

    input.addEventListener(
      "input",
      () => {
        durationDirty = true;
      }
    );

    input.addEventListener(
      "change",
      () => {
        durationDirty = true;
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

        const userCredential =
          await auth.signInWithEmailAndPassword(
            $("email").value.trim(),
            $("password").value
          );

        if (
          userCredential.user.uid !== ADMIN_UID
        ) {
          await auth.signOut();

          throw Error(
            "This is not the organizer account."
          );
        }

        $("password").value = "";

      } catch (err) {

        $("loginError").textContent =
          err?.message ||
          "Login failed.";
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

  // AUTHENTICATION

  auth.onAuthStateChanged(
    async user => {

      authorized = Boolean(
        user &&
        user.uid === ADMIN_UID
      );

      stopPrivate();

      if (user && !authorized) {

        await auth.signOut();

        return;
      }

      if (authorized) {
        listenPrivate();
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
    }
  );

  // LIVE TIMER FROM FIREBASE

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

      message(
        "Live timer: " + err.message,
        true
      );
    }
  );

  // REFRESH CLOCK EVERY 200 MS

  setInterval(render, 200);

  render();

})();
