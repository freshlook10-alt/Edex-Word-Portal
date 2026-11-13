
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EDEX | Guess the Item in the Box Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

<style>
:root {
  color-scheme:dark;
  --gold:#f8d991;
  --txt:#f9f5ff;
  --muted:#bdb3d1;
}
* { box-sizing:border-box; }

body {
  margin:0;
  min-height:100vh;
  color:var(--txt);
  font-family:Outfit,Arial,sans-serif;
  background:radial-gradient(
    ellipse at 50% 0%,#50336e 0,
    #1a1532 48%,#090a1c 100%
  );
}

[hidden] { display:none!important; }
button,input { font:inherit; }
button { cursor:pointer; }
button:disabled { opacity:.5;cursor:default; }
a { text-decoration:none; }

.wrap {
  width:min(1160px,calc(100% - 30px));
  margin:0 auto;
  padding:20px 0 60px;
}

.brand {
  font-size:26px;
  font-weight:900;
  letter-spacing:.17em;
  color:var(--gold);
}

.brand small {
  display:block;
  color:#b5a7cb;
  font-size:10px;
  letter-spacing:.22em;
}

/* THREE ADMIN TABS */

.tabs {
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:11px;
  margin:25px 0 15px;
}

.tabs a {
  border:1px solid #8a6caa;
  border-radius:13px;
  min-height:52px;
  background:#453256;
  color:#f5eaff;
  text-align:center;
  padding:15px 8px;
  font-weight:900;
  font-size:13px;
}

.tabs a.active {
  background:linear-gradient(110deg,#ffe2a2,#edc16c);
  color:#26190a;
  border-color:#ffe2a2;
}

/* VISITOR PAGE LINK */

.visitor {
  display:block;
  width:min(100%,500px);
  margin:0 auto 25px;
  background:linear-gradient(100deg,#ffe3a2,#edc16c);
  border:1px solid #ffe2a2;
  border-radius:13px;
  text-align:center;
  color:#271c0b;
  font-weight:900;
  padding:15px;
}

/* PANELS */

.panel {
  border:1px solid #5f5278;
  border-radius:20px;
  padding:22px;
  background:#211d39ee;
  margin:14px 0;
  box-shadow:0 15px 38px #0003;
}

h1 {
  font-size:clamp(32px,4.5vw,52px);
  margin:10px 0;
}

h1 em {
  font-style:normal;
  color:var(--gold);
}

h2 { margin:0 0 12px;font-size:21px; }
p { color:var(--muted);line-height:1.55; }

.eyebrow {
  color:#dcc2ff;
  font-size:11px;
  letter-spacing:.18em;
  font-weight:900;
}

.row {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.btn {
  border:1px solid #705e89;
  background:#493861;
  color:#f8f2ff;
  border-radius:11px;
  min-height:44px;
  padding:12px 16px;
  font-weight:900;
  font-size:13px;
}

.btn:hover:not(:disabled) {
  filter:brightness(1.1);
}

.btn.gold {
  background:var(--gold);
  color:#271d10;
  border-color:var(--gold);
}

.btn.red {
  background:#6d334a;
  color:#ffdeea;
  border-color:#a45b73;
}

input {
  padding:12px;
  border:1px solid #746488;
  border-radius:11px;
  color:white;
  background:#0e1026;
  width:100%;
}

label {
  display:block;
  font-size:13px;
  font-weight:800;
  margin:13px 0 8px;
  color:#dfd3f0;
}

.login {
  max-width:470px;
  margin:35px auto;
}

.login button {
  width:100%;
  margin-top:16px;
}

.error { color:#ff9cb1; }

/* STATISTICS */

.stats {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px;
}

.stats .panel { min-height:130px; }

.stats small {
  color:#c4b2dc;
  font-size:11px;
  font-weight:800;
  letter-spacing:.08em;
}

.stats strong {
  font-size:44px;
  display:block;
  margin-top:9px;
}

/* CONTROL PANELS */

.two {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:15px;
}

.two .panel { margin:0; }

.stock {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin:15px 0;
}

.stock div {
  border:1px solid #5c4c74;
  padding:14px;
  border-radius:13px;
  background:#121228;
}

.stock small {
  color:#b7a8c6;
  font-weight:800;
}

.stock strong {
  display:block;
  font-size:32px;
  margin-top:5px;
  color:var(--gold);
}

.buttons {
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.buttons button { flex:1; }

.timer {
  font-size:60px;
  font-weight:900;
  color:var(--gold);
  letter-spacing:-.04em;
  text-align:center;
}

.stage {
  text-align:center;
  color:#c8aadf;
  font-size:12px;
  font-weight:900;
  letter-spacing:.2em;
}

/* RECORDS */

.tablewrap {
  overflow:auto;
  max-height:440px;
  border:1px solid #655279;
  border-radius:12px;
  margin-top:14px;
}

table {
  width:100%;
  border-collapse:collapse;
  min-width:700px;
}

th,td {
  padding:12px;
  text-align:left;
  border-bottom:1px solid #413851;
  font-size:13px;
}

th {
  color:#ddc3f4;
  background:#322947;
  position:sticky;
  top:0;
}

.notice {
  font-size:13px;
  color:#b9f1dc;
  min-height:22px;
}

.note { font-size:12px; }
.signout { margin-left:auto; }

@media(max-width:850px) {
  .stats {
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  .two { grid-template-columns:1fr; }
  .two .panel { margin:7px 0; }
}

@media(max-width:550px) {
  .tabs { gap:5px; }
  .tabs a { font-size:11px;padding:11px 4px; }
  .panel { padding:16px; }
  .buttons button { flex:1 1 100%; }
}
</style>
</head>

<body>
<div class="wrap">

  <header class="brand">
    ✦ EDEX
    <small>GUESS THE ITEM IN THE BOX · ADMIN</small>
  </header>

  <!-- THREE ADMIN NAVIGATION TABS -->

  <nav class="tabs" aria-label="EDEX Admin navigation">

    <a href="https://freshlook10-alt.github.io/arabic-choclate-quiz/admin.html">
      ✦ Quiz Admin
    </a>

    <a class="active"
       aria-current="page"
       href="admin.html">
      📦 Guess the Item in the Box
    </a>

    <a href="https://freshlook10-alt.github.io/edex-timer-challenge/admin.html">
      ⏱ Timer Admin
    </a>

  </nav>

  <!-- OPENS VISITOR / ORGANIZER IN NEW TAB -->

  <a class="visitor"
     href="index.html"
     target="_blank"
     rel="noopener noreferrer">
    ↗ OPEN BOX GAME VISITOR / ORGANIZER
  </a>

  <!-- LOGIN -->

  <section id="adminLogin" class="panel login">

    <div class="eyebrow">✦ AUTHORIZED ORGANIZER</div>
    <h1>Box Game <em>Admin.</em></h1>

    <p>
      Sign in to manage rounds, inventory
      and saved records.
    </p>

    <form id="loginForm">

      <label for="email">Email</label>
      <input id="email"
             type="email"
             autocomplete="username"
             required>

      <label for="password">Password</label>
      <input id="password"
             type="password"
             autocomplete="current-password"
             required>

      <button class="btn gold" type="submit">
        Open Admin
      </button>

      <p id="loginError"
         class="error"
         role="alert"></p>

    </form>
  </section>

  <!-- MAIN ADMIN DASHBOARD -->

  <section id="adminContent" hidden>

    <div class="row">

      <div>
        <div class="eyebrow">
          ✦ LIVE CHALLENGE MANAGEMENT
        </div>

        <h1>Event <em>Overview.</em></h1>

        <p>
          Session counters reset without deleting
          past rounds or replacing chocolates.
        </p>
      </div>

      <button class="btn signout"
              id="signout"
              type="button">
        Sign Out
      </button>

    </div>

    <!-- GAME COUNTERS -->

    <div class="stats">

      <div class="panel">
        <small>ROUNDS PLAYED</small>
        <strong id="played">0</strong>
      </div>

      <div class="panel">
        <small>WON</small>
        <strong id="wins">0</strong>
      </div>

      <div class="panel">
        <small>FAILED</small>
        <strong id="losses">0</strong>
      </div>

      <div class="panel">
        <small>CHOCOLATES THIS SESSION 🍫</small>
        <strong id="chocolates">0</strong>
      </div>

    </div>

    <div class="two">

      <!-- TIMER -->

      <section class="panel">

        <div class="eyebrow">01 / LIVE TIMER</div>

        <div class="timer" id="adminTimer">
          02:00
        </div>

        <div class="stage" id="adminStage">
          IDLE
        </div>

        <div class="buttons" style="margin:18px 0">

          <button class="btn gold"
                  id="startBtn"
                  type="button">
            ▶ START TIMER
          </button>

          <button class="btn gold"
                  id="winBtn"
                  type="button">
            🍫 WON +1
          </button>

          <button class="btn"
                  id="failBtn"
                  type="button">
            ✕ FAILED
          </button>

        </div>

        <button class="btn"
                id="resetRoundBtn"
                type="button">
          ↺ Cancel Current Round
        </button>

        <label for="durationInput">
          Time for next round (MM:SS)
        </label>

        <input id="durationInput"
               value="02:00"
               maxlength="5"
               placeholder="01:30">

        <button class="btn private-action"
                id="saveDurationBtn"
                type="button"
                style="margin-top:10px">
          Save Timer
        </button>

        <p class="note">
          Examples: 01:30, 02:00, 02:30.
          No randomizer or Arabic word list.
        </p>

      </section>

      <!-- CHOCOLATE STOCK -->

      <section class="panel">

        <div class="eyebrow">
          02 / CHOCOLATE INVENTORY
        </div>

        <h2>Chocolate Stock</h2>

        <div class="stock">

          <div>
            <small>TOTAL</small>
            <strong id="stock">—</strong>
          </div>

          <div>
            <small>REMAINING</small>
            <strong id="remainingStock">—</strong>
          </div>

        </div>

        <label for="stockInput">
          Set total chocolates for this game
        </label>

        <input id="stockInput"
               type="number"
               min="0"
               step="1"
               placeholder="Example: 100">

        <button class="btn gold private-action"
                id="stockBtn"
                type="button"
                style="margin-top:10px">
          Save Stock
        </button>

        <p class="note">
          Chocolates already distributed stay deducted
          when starting a new session. This stock is
          still for this game, not yet shared across
          Quiz and Timer.
        </p>

      </section>

    </div>

    <!-- ROUND HISTORY AND RESET -->

    <section class="panel">

      <div class="row">

        <div>
          <div class="eyebrow">03 / HISTORY</div>
          <h2>Played Rounds</h2>
        </div>

        <div class="buttons">

          <button class="btn private-action"
                  id="csv"
                  type="button">
            ↓ Session CSV
          </button>

          <button class="btn private-action"
                  id="csvAll"
                  type="button">
            ↓ All History CSV
          </button>

          <button class="btn red private-action"
                  id="resetSession"
                  type="button">
            ↺ Reset Session
          </button>

        </div>

      </div>

      <div class="tablewrap">

        <table>

          <thead>
            <tr>
              <th>DATE</th>
              <th>GAME / ITEM</th>
              <th>RESULT</th>
              <th>CHOCOLATE</th>
              <th>TIME USED</th>
            </tr>
          </thead>

          <tbody id="records">
            <tr>
              <td colspan="5">
                Loading history…
              </td>
            </tr>
          </tbody>

        </table>

      </div>

      <p class="note">
        Reset Session starts the displayed counts
        at zero. Older records remain in Firebase
        and All History CSV. Chocolates are not refunded.
      </p>

      <p class="notice"
         id="actionMessage"
         role="status"></p>

    </section>

  </section>
</div>

<!-- EXISTING FIREBASE LIBRARIES -->

<script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore-compat.js"></script>

<!-- KEEP YOUR ORIGINAL FIREBASE CONFIG -->

<script src="firebase-config.js"></script>

<!-- NEW APP.JS FROM STEP 3 -->

<script src="app.js"></script>

</body>
</html>
