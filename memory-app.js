
/*
 EDEX MEMORY SHUFFLE

 Uses existing Firebase configuration.

 Memory Shuffle results are identified
 by gameType = "memory-shuffle".

 Existing Box Game chocolate counters
 are not changed.
*/

(() => {
  "use strict";

  const $ = id =>
    document.getElementById(id);

  const adminPage =
    document.body.dataset.page === "admin";

  const FV =
    firebase.firestore.FieldValue;

  const liveRef =
    db.collection("wordPortal")
      .doc("live");

  const historyRef =
    db.collection("wordHistory");

  const GAME = "memory-shuffle";

  let loggedIn = false;
  let busy = false;

  let live = {};
  let records = [];

  let stopHistory = null;
  let dataReady = false;

  // SHOW MESSAGES

  function show(message, bad = false) {

    const target = $("notice");

    if (target) {
      target.textContent = message;

      target.style.color = bad
        ? "#ff9aa9"
        : "#aaf2cf";
    }
  }

  // FIREBASE TIMESTAMP TO MILLISECONDS

  function millis(t) {
    return t?.toMillis?.() || 0;
  }

  // FILTER CURRENT SESSION RECORDS

  function currentRecords() {

    const start =
      millis(live.memorySessionStartedAt);

    return records.filter(record => {

      if (!start) return true;

      const at =
        millis(record.at) ||
        record.createdAtMs ||
        0;

      return at > start;
    });
  }

  // FORMAT DATE

  function stamp(value) {

    return value?.toDate?.()
      .toLocaleString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        }
      ) || "Saving...";
  }

  // UPDATE DISPLAY

  function render() {

    const round =
      Number(live.memoryRound || 0);

    if ($("roundNumber")) {
      $("roundNumber").textContent =
        String(round);
    }

    // SHOW LAST RESULT FOR EIGHT SECONDS

    if ($("lastResult")) {

      const fresh =
        millis(live.memoryUpdatedAt) > 0 &&
        Date.now() -
        millis(live.memoryUpdatedAt) < 8000;

      const state = fresh
        ? live.memoryLastResult
        : "ready";

      $("lastResult").textContent =
        state === "won"
          ? "🍫 CHOCOLATE WON!"
          : state === "lost"
            ? "✕ NOT WON"
            : "WATCH • REMEMBER • GUESS";

      $("lastResult").className =
        state === "won"
          ? "won-result"
          : state === "lost"
            ? "lost-result"
            : "";
    }

    if ($("connection")) {
      $("connection").textContent =
        "● LIVE";
    }

    if ($("loginPanel")) {
      $("loginPanel").hidden =
        loggedIn;
    }

    if ($("privatePanel")) {
      $("privatePanel").hidden =
        !loggedIn;
    }

    // BUTTONS

    for (const id of [
      "wonBtn",
      "lostBtn",
      "resetSessionBtn",
      "csvSessionBtn",
      "csvAllBtn"
    ]) {

      if ($(id)) {
        $(id).disabled =
          !loggedIn || busy;
      }
    }

    // ADMIN STATISTICS

    if (adminPage && loggedIn) {

      const now =
        currentRecords();

      const wins =
        now.filter(record =>
          record.outcome === "won"
        ).length;

      const losses =
        now.length - wins;

      $("played").textContent =
        String(now.length);

      $("wins").textContent =
        String(wins);

      $("losses").textContent =
        String(losses);

      $("chocolates").textContent =
        String(wins);

      $("lifetime").textContent =
        String(
          records.filter(record =>
            record.outcome === "won"
          ).length
        );

      // HISTORY TABLE

      const tbody =
        $("historyBody");

      tbody.replaceChildren();

      const sorted =
        [...now].sort((a, b) => {

          const aTime =
            millis(a.at) ||
            a.createdAtMs ||
            0;

          const bTime =
            millis(b.at) ||
            b.createdAtMs ||
            0;

          return bTime - aTime;
        });

      for (const record of sorted.slice(0, 100)) {

        const row =
          tbody.insertRow();

        const values = [

          stamp(record.at),

          record.round || "—",

          record.outcome === "won"
            ? "🍫 WON"
            : "✕ NOT WON",

          record.chocolate || 0

        ];

        values.forEach(value => {

          row.insertCell()
            .textContent =
              String(value);
        });
      }

      if (!tbody.rows.length) {

        const cell =
          tbody.insertRow()
            .insertCell();

        cell.colSpan = 4;

        cell.textContent =
          "No results in this session.";
      }
    }
  }

  // AVOID DUPLICATE CLICKS

  async function doAction(work) {

    if (!loggedIn || busy) {
      return;
    }

    busy = true;
    render();

    try {

      await work();

    } catch (err) {

      console.error(err);

      show(
        "Could not save: " +
        (
          err.message ||
          err.code ||
          "Unknown error"
        ),
        true
      );

    } finally {

      busy = false;
      render();
    }
  }

  // RECORD WON OR NOT WON

  async function markResult(won) {

    await db.runTransaction(async tx => {

      const snap =
        await tx.get(liveRef);

      const round =
        Number(
          snap.data()?.memoryRound || 0
        ) + 1;

      const doc =
        historyRef.doc();

      // SAVE GAME RESULT

      tx.set(doc, {

        gameType: GAME,

        round: round,

        roundId: round,

        word: "",

        durationSec: 0,

        elapsedSec: 0,

        outcome:
          won ? "won" : "lost",

        chocolate:
          won ? 1 : 0,

        at:
          FV.serverTimestamp(),

        createdAtMs:
          Date.now()
      });

      // PUBLISH RESULT TO VISITOR PAGE

      tx.set(
        liveRef,
        {

          memoryRound: round,

          memoryLastResult:
            won ? "won" : "lost",

          memoryUpdatedAt:
            FV.serverTimestamp()

        },
        {
          merge: true
        }
      );

    });

    show(
      won
        ? "🍫 WON recorded. One chocolate given."
        : "NOT WON recorded. No chocolate given."
    );
  }

  // RESET CURRENT SESSION

  // OLDER RECORDS ARE PRESERVED

  async function resetSession() {

    if (!dataReady) {

      throw Error(
        "Wait for results to finish loading."
      );
    }

    const confirmed = confirm(
      "Start a fresh Memory Shuffle session?\n\n" +
      "Old results and chocolate awards " +
      "stay saved in All History CSV."
    );

    if (!confirmed) {
      return;
    }

    await liveRef.set(
      {

        memorySessionStartedAt:
          FV.serverTimestamp(),

        memoryLastResult:
          "ready",

        memoryUpdatedAt:
          FV.serverTimestamp()

      },
      {
        merge: true
      }
    );

    show(
      "New session started. Previous " +
      "awards were not deleted or refunded."
    );
  }

  // SAFE CSV TEXT

  function cell(value) {

    let text =
      String(value ?? "");

    if (/^\s*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' +
      text.replaceAll('"', '""') +
      '"';
  }

  // EXPORT SESSION / ALL HISTORY

  function exportCSV(all) {

    if (!dataReady) {

      throw Error(
        "Wait for history to load."
      );
    }

    const data =
      all
        ? records
        : currentRecords();

    const rows = [[
      "Time",
      "Round",
      "Game",
      "Result",
      "Chocolate"
    ]];

    data.forEach(record => {

      rows.push([

        stamp(record.at),

        record.round || "",

        "Memory Shuffle",

        record.outcome === "won"
          ? "WON"
          : "NOT WON",

        record.chocolate || 0

      ]);
    });

    const csv = "\uFEFF" +

      rows.map(row =>
        row.map(cell).join(",")
      ).join("\r\n");

    const url =
      URL.createObjectURL(

        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8"
          }
        )
      );

    const link =
      document.createElement("a");

    link.href = url;

    link.download = all
      ? "edex-memory-all-history.csv"
      : "edex-memory-session.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    show(
      "CSV exported."
    );
  }

  // LOGIN

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
            "This account is not the " +
            "authorized organizer."
          );
        }

        $("password").value = "";

      } catch (err) {

        $("loginError").textContent =
          err.message ||
          "Login failed.";
      }
    }
  );

  // LOG OUT

  $("logoutBtn")
    .addEventListener(
      "click",
      () => {

        if (!busy) {
          auth.signOut();
        }
      }
    );

  // TWO RESULT BUTTONS

  $("wonBtn")
    .addEventListener(
      "click",
      () => doAction(
        () => markResult(true)
      )
    );

  $("lostBtn")
    .addEventListener(
      "click",
      () => doAction(
        () => markResult(false)
      )
    );

  // ADMIN BUTTONS

  if (adminPage) {

    $("resetSessionBtn")
      .addEventListener(
        "click",
        () => doAction(
          resetSession
        )
      );

    $("csvSessionBtn")
      .addEventListener(
        "click",
        () => doAction(
          () => exportCSV(false)
        )
      );

    $("csvAllBtn")
      .addEventListener(
        "click",
        () => doAction(
          () => exportCSV(true)
        )
      );
  }

  // FIREBASE AUTHENTICATION

  auth.onAuthStateChanged(
    async user => {

      if (stopHistory) {

        stopHistory();

        stopHistory = null;
      }

      loggedIn =
        Boolean(user) &&
        user.uid === ADMIN_UID;

      records = [];
      dataReady = false;

      if (user && !loggedIn) {

        await auth.signOut();

        return;
      }

      if (loggedIn) {

        stopHistory = historyRef
          .where(
            "gameType",
            "==",
            GAME
          )
          .onSnapshot(

            snapshot => {

              records =
                snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));

              dataReady = true;

              render();
            },

            err => {

              show(
                "History unavailable: " +
                err.message,
                true
              );
            }
          );
      }

      render();
    }
  );

  // PUBLIC LIVE RESULT

  liveRef.onSnapshot(

    snapshot => {

      live =
        snapshot.data() || {};

      render();
    },

    err => {

      if ($("connection")) {

        $("connection").textContent =
          "● OFFLINE";
      }

      show(
        "Live data unavailable: " +
        err.message,
        true
      );
    }
  );

  // RETURN TO READY DISPLAY
  // EIGHT SECONDS AFTER EACH RESULT

  setInterval(
    render,
    1000
  );

  render();

})();
