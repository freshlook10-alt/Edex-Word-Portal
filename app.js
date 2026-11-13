
/*
 EDEX — GUESS THE ITEM IN THE BOX

 Complete game logic.
 Uses the existing Firebase project.

 Firebase collections:
 wordPortal/live
 wordSettings/main
 wordStats/total
 wordHistory

 Keeps existing records and chocolate totals.
 No word randomizer.
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

  const FV =
    firebase.firestore.FieldValue;

  let live = {
    stage:"idle",
    roundId:0,
    durationSec:120
  };

  let settings = {
    durationSec:120
  };

  let stats = {};
  let history = [];

  let authorized = false;
  let busy = false;

  let unsubscribePrivate = [];

  let hasStats = false;
  let hasHistory = false;

  let messageTimer;

  // TIME FORMAT

  function seconds(value) {
    const n = Math.max(0,Math.ceil(value));

    return (
      String(Math.floor(n / 60)).padStart(2,"0") +
      ":" +
      String(n % 60).padStart(2,"0")
    );
  }

  // TIMER DURATION

  function duration() {
    const value =
      live.stage === "running"
        ? live.durationSec
        : settings.durationSec ||
          live.durationSec ||
          120;

    return Math.max(10,Number(value) || 120);
  }

  // LIVE REMAINING TIME

  function remaining() {
    if (live.stage !== "running") {
      return duration();
    }

    if (!live.startedAt?.toMillis) {
      return duration();
    }

    const finish =
      live.startedAt.toMillis() +
      duration() * 1000;

    return Math.max(
      0,
      (finish - Date.now()) / 1000
    );
  }

  // GAME STAGE

  function currentStage() {
    if (
      live.stage === "running" &&
      live.startedAt?.toMillis &&
      remaining() <= 0
    ) {
      return "expired";
    }

    if (live.stage === "running") {
      return "running";
    }

    // Older Word Portal stage names are
    // treated as idle after the change.

    return "idle";
  }

  // DISPLAY MESSAGES

  function setMessage(text,bad=false) {
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
      },5000);
    }
  }

  // PREVENT DOUBLE CLICKS

  async function perform(task) {
    if (!authorized || busy) return;

    busy = true;
    render();

    try {
      await task();
    } catch (err) {
      console.error(err);

      setMessage(
        err.message ||
        "Operation failed. Check Firebase permissions.",
        true
      );
    } finally {
      busy = false;
      render();
    }
  }

  // CURRENT SESSION COUNTER

  function calcSession(field) {
    const baselineKey =
      "baseline" +
      field.charAt(0).toUpperCase() +
      field.slice(1);

    const lifetime =
      Number(stats[field] || 0);

    const baseline =
      Number(stats[baselineKey] || 0);

    return Math.max(0,lifetime - baseline);
  }

  // LAST SESSION RESET TIME

  function sessionStart() {
    return (
      stats.sessionResetAt?.toMillis?.() || 0
    );
  }

  function inSession(record) {
    const start = sessionStart();

    return !start ||
      (record.at?.toMillis?.() || 0) > start;
  }

  // DATE FORMAT

  function dateText(timestamp) {
    return timestamp?.toDate
      ? timestamp.toDate().toLocaleString(
          "en-US",
          {
            dateStyle:"medium",
            timeStyle:"short"
          }
        )
      : "Saving…";
  }

  // MAIN RENDER

  function render() {
    if (isAdmin) {
      renderAdmin();
    } else {
      renderGame();
    }
  }

  // VISITOR / ORGANIZER SCREEN

  function renderGame() {
    const left = remaining();
    const stage = currentStage();

    $("timeText").textContent =
      seconds(left);

    $("statusText").textContent =
      stage === "running"
        ? "GUESS NOW"
        : stage === "expired"
          ? "TIME IS UP"
          : "READY";

    $("roundLabel").textContent =
      "ROUND " + (live.roundId || 0);

    $("subtitle").textContent =
      stage === "running"
        ? "Feel the object and make your guess before time runs out!"
        : stage === "expired"
          ? "Time is up. Ask the organizer to record the result."
          : "No looking! Reach inside the box and guess the mystery item.";

    $("clock").classList.toggle(
      "expired",
      stage === "expired"
    );

    // CIRCULAR PROGRESS

    const ring = $("progress");

    const circumference =
      2 * Math.PI * 109;

    ring.style.strokeDasharray =
      circumference;

    ring.style.strokeDashoffset =
      circumference *
      (
        1 -
        Math.max(
          0,
          Math.min(1,left / duration())
        )
      );

    // ORGANIZER BUTTONS

    $("startBtn").disabled =
      busy || stage !== "idle" || !authorized;

    $("winBtn").disabled =
      busy || stage !== "running" || !authorized;

    $("failBtn").disabled =
      busy ||
      !["running","expired"].includes(stage) ||
      !authorized;

    $("resetRoundBtn").disabled =
      busy || stage === "idle" || !authorized;

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

    [
      "played",
      "wins",
      "losses",
      "chocolates"
    ].forEach(field => {
      $(field).textContent =
        calcSession(field).toLocaleString();
    });

    // CHOCOLATE STOCK
    // Based on LIFETIME chocolates given.

    const stockTotal = stats.stockTotal;

    const tracked =
      Number.isSafeInteger(stockTotal) &&
      stockTotal >= 0;

    $("stock").textContent = tracked
      ? stockTotal.toLocaleString()
      : "Not set";

    $("remainingStock").textContent =
      tracked
        ? Math.max(
            0,
            stockTotal -
            Number(stats.chocolates || 0)
          ).toLocaleString()
        : "Not set";

    // TIMER

    const stage = currentStage();

    $("adminTimer").textContent =
      seconds(remaining());

    $("adminStage").textContent =
      stage.toUpperCase();

    $("startBtn").disabled =
      busy || stage !== "idle";

    $("winBtn").disabled =
      busy || stage !== "running";

    $("failBtn").disabled =
      busy ||
      !["running","expired"].includes(stage);

    $("resetRoundBtn").disabled =
      busy || stage === "idle";

    document.querySelectorAll(
      ".private-action"
    ).forEach(button => {
      button.disabled = busy;
    });

    if (
      document.activeElement !==
      $("durationInput")
    ) {
      $("durationInput").value =
        seconds(Number(settings.durationSec || 120));
    }
  }

  // DISPLAY ROUND HISTORY

  function renderHistory() {
    if (!isAdmin || !authorized) return;

    const tbody = $("records");
    tbody.replaceChildren();

    const visible =
      history.filter(inSession);

    if (!visible.length) {
      const row = tbody.insertRow();
      const cell = row.insertCell();

      cell.colSpan = 5;
      cell.textContent =
        "No rounds in the current session.";

      return;
    }

    visible.forEach(record => {
      const row = tbody.insertRow();

      const item =
        record.gameType === "guess-box"
          ? "Mystery Item"
          : record.word || "Earlier Ball Game";

      const values = [
        dateText(record.at),
        item,
        record.outcome === "won"
          ? "WON"
          : "FAILED",
        record.chocolate || 0,
        seconds(record.elapsedSec || 0)
      ];

      values.forEach(value => {
        const cell = row.insertCell();
        cell.textContent = String(value);
      });
    });
  }

  // START THE NEXT ROUND
  // NO WORD RANDOMIZER

  async function startRound() {
    await db.runTransaction(async tx => {

      const [liveSnap,settingsSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(settingsRef)
        ]);

      const current =
        liveSnap.data() || {};

      if (current.stage === "running") {
        throw Error(
          "Finish or reset the active round first."
        );
      }

      const durationSec =
        Number(
          settingsSnap.data()?.durationSec || 120
        );

      tx.set(liveRef,{
        stage:"running",

        roundId:
          Number(current.roundId || 0) + 1,

        durationSec:durationSec,

        startedAt:
          FV.serverTimestamp(),

        word:"",
        gameType:"guess-box"

      },{merge:true});

    });

    setMessage("Timer started. Good luck!");
  }

  // FINISH ROUND
  // WON = ONE CHOCOLATE
  // FAILED = ZERO CHOCOLATES

  async function finishRound(won) {

    const recordRef =
      historyRef.doc();

    await db.runTransaction(async tx => {

      const [liveSnap,statsSnap] =
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
        throw Error("No active round.");
      }

      const elapsed =
        (
          Date.now() -
          round.startedAt.toMillis()
        ) / 1000;

      if (
        won &&
        elapsed >= Number(round.durationSec || 120)
      ) {
        throw Error(
          "Time is up. Choose FAILED."
        );
      }

      const currentStats =
        statsSnap.data() || {};

      // PREVENT EXCEEDING THIS GAME'S STOCK

      if (
        won &&
        Number.isSafeInteger(currentStats.stockTotal) &&
        Number(currentStats.chocolates || 0) >=
          currentStats.stockTotal
      ) {
        throw Error(
          "No chocolates left in this game stock. Update stock in Admin."
        );
      }

      // SAVE HISTORY

      tx.set(recordRef,{
        gameType:"guess-box",
        itemLabel:"Mystery Item",
        word:"",
        roundId:round.roundId,
        outcome:won ? "won" : "lost",
        chocolate:won ? 1 : 0,
        durationSec:
          Number(round.durationSec || 120),

        elapsedSec:
          Math.max(
            0,
            Math.min(
              Number(round.durationSec || 120),
              Math.round(elapsed)
            )
          ),

        at:FV.serverTimestamp()
      });

      // KEEP EXISTING LIFETIME COUNTERS

      tx.set(statsRef,{
        played:FV.increment(1),
        wins:FV.increment(won ? 1 : 0),
        losses:FV.increment(won ? 0 : 1),
        chocolates:FV.increment(won ? 1 : 0)
      },{merge:true});

      // RESET LIVE ROUND ONLY

      tx.set(liveRef,{
        stage:"idle",
        startedAt:null,
        word:""
      },{merge:true});

    });

    setMessage(
      won
        ? "🍫 WON! One chocolate recorded."
        : "FAILED — no chocolate recorded."
    );
  }

  // CANCEL ROUND
  // DOES NOT RECORD A RESULT

  async function resetRound() {
    if (!confirm(
      "Cancel this round without counting a win or failure?"
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const snapshot =
        await tx.get(liveRef);

      if (
        !snapshot.exists ||
        !["running","ready"].includes(
          snapshot.data().stage
        )
      ) {
        return;
      }

      tx.set(liveRef,{
        stage:"idle",
        startedAt:null,
        word:""
      },{merge:true});

    });

    setMessage(
      "Current round cancelled. No chocolate counted."
    );
  }

  // TIMER INPUT FORMAT

  function parseDuration(value) {
    const match =
      /^(\d{1,2}):([0-5]\d)$/.exec(
        value.trim()
      );

    if (!match) {
      throw Error(
        "Use MM:SS, for example 01:30 or 02:30."
      );
    }

    const total =
      Number(match[1]) * 60 +
      Number(match[2]);

    if (total < 10 || total > 900) {
      throw Error(
        "Choose between 00:10 and 15:00."
      );
    }

    return total;
  }

  // SAVE TIMER DURATION

  async function saveDuration() {
    const secondsToSave =
      parseDuration($("durationInput").value);

    await settingsRef.set({
      durationSec:secondsToSave
    },{merge:true});

    setMessage(
      "Timer duration saved. Applies to the next round."
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

      const snapshot =
        await tx.get(statsRef);

      const used =
        Number(
          snapshot.data()?.chocolates || 0
        );

      if (total < used) {
        throw Error(
          "Total stock cannot be less than chocolates already awarded (" +
          used + ")."
        );
      }

      tx.set(statsRef,{
        stockTotal:total
      },{merge:true});

    });

    $("stockInput").value = "";

    setMessage(
      "Chocolate stock saved. Existing chocolates remain counted."
    );
  }

  // RESET SESSION
  // KEEP ALL OLD RECORDS AND CHOCOLATES

  async function resetSession() {
    if (!hasStats || !hasHistory) {
      throw Error(
        "Wait for round history to finish loading."
      );
    }

    if (!confirm(
      "Start a new Guess the Item in the Box session?\n\n" +
      "Displayed counters reset to zero, but " +
      "ALL historical records and chocolates " +
      "already awarded remain saved."
    )) {
      return;
    }

    await db.runTransaction(async tx => {

      const [liveSnap,statsSnap] =
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

      tx.set(statsRef,{

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

      },{merge:true});

    });

    setMessage(
      "New session started. Earlier history and physical stock preserved."
    );
  }

  // SAFE CSV CELL

  function csvCell(value) {
    let text = String(value ?? "");

    if (/^\s*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' +
      text.replaceAll('"','""') +
      '"';
  }

  // EXPORT CSV

  async function downloadCSV(all) {

    const snapshot =
      await historyRef
        .orderBy("at","desc")
        .get();

    const list =
      snapshot.docs
        .map(doc => doc.data())
        .filter(record =>
          all || inSession(record)
        );

    const rows = [[
      "Date",
      "Game",
      "Item or earlier word",
      "Round",
      "Result",
      "Chocolates",
      "Time used (seconds)"
    ]];

    list.forEach(record => {

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

    });

    const csv = "\uFEFF" +
      rows.map(row =>
        row.map(csvCell).join(",")
      ).join("\r\n");

    const blob = new Blob(
      [csv],
      {
        type:"text/csv;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = all
      ? "edex-box-all-history.csv"
      : "edex-box-current-session.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    setMessage("CSV exported.");
  }

  // STOP OLD DATABASE LISTENERS

  function stopPrivate() {
    unsubscribePrivate.forEach(
      stop => stop()
    );

    unsubscribePrivate = [];
  }

  // WATCH FIREBASE DATA

  function watchPrivate() {

    unsubscribePrivate.push(
      settingsRef.onSnapshot(
        snapshot => {
          settings = {
            ...settings,
            ...(snapshot.data() || {})
          };

          render();
        },
        err => {
          setMessage(err.message,true);
        }
      )
    );

    if (isAdmin) {

      unsubscribePrivate.push(
        statsRef.onSnapshot(
          snapshot => {
            stats = snapshot.data() || {};
            hasStats = true;

            render();
            renderHistory();
          },
          err => {
            setMessage(err.message,true);
          }
        )
      );

      unsubscribePrivate.push(
        historyRef
          .orderBy("at","desc")
          .limit(200)
          .onSnapshot(
            snapshot => {
              history =
                snapshot.docs.map(
                  doc => doc.data()
                );

              hasHistory = true;

              render();
              renderHistory();
            },
            err => {
              setMessage(err.message,true);
            }
          )
      );

    }
  }

  // ATTACH BUTTON ACTIONS

  function bind(id,task) {
    const element = $(id);

    if (element) {
      element.addEventListener(
        "click",
        () => perform(task)
      );
    }
  }

  bind("startBtn",startRound);

  bind(
    "winBtn",
    () => finishRound(true)
  );

  bind(
    "failBtn",
    () => finishRound(false)
  );

  bind("resetRoundBtn",resetRound);

  if (isAdmin) {

    bind("saveDurationBtn",saveDuration);

    bind("stockBtn",saveStock);

    bind("resetSession",resetSession);

    bind(
      "csv",
      () => downloadCSV(false)
    );

    bind(
      "csvAll",
      () => downloadCSV(true)
    );
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

        if (
          credential.user.uid !== ADMIN_UID
        ) {
          await auth.signOut();

          throw Error(
            "This is not the organizer account."
          );
        }

        $("password").value = "";

      } catch (err) {

        $("loginError").textContent =
          err.message || "Login failed.";

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

  // AUTHENTICATION CHANGES

  auth.onAuthStateChanged(async user => {

    authorized =
      Boolean(user) &&
      user.uid === ADMIN_UID;

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

  // LIVE TIMER STATE

  liveRef.onSnapshot(
    snapshot => {

      live = {
        ...live,
        ...(snapshot.data() || {})
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

      setMessage(err.message,true);
    }
  );

  // UPDATE TIMER DISPLAY

  setInterval(render,200);

  render();

})();
