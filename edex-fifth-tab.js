
/*
  EDEX — COMPLETE FIVE-GAME NAVIGATION

  Use this ONE script on every Admin page.

  Correct existing filenames:
  hitbox.html
  hitbox-admin.html
  hitbox.js
  edex fifth tab.js

  This changes navigation only.
  It does not touch Firebase or game records.
*/

(() => {
  "use strict";

  const ROOT =
    "https://freshlook10-alt.github.io";

  const GAMES = [
    {
      name: "✦ Quiz Admin",
      url:
        ROOT +
        "/arabic-choclate-quiz/admin.html"
    },
    {
      name: "📦 Guess the Item in the Box",
      url:
        ROOT +
        "/Edex-Word-Portal/admin.html"
    },
    {
      name: "⏱ Timer Admin",
      url:
        ROOT +
        "/edex-timer-challenge/admin.html"
    },
    {
      name: "🧠 Memory Shuffle Admin",
      url:
        ROOT +
        "/Edex-Word-Portal/memory-admin.html"
    },
    {
      name: "🎯 Hit the Box",
      url:
        ROOT +
        "/Edex-Word-Portal/hitbox-admin.html"
    }
  ];

  function buildNavigation() {

    const nav = document.querySelector(
      "nav.edex-tabs, nav.tabs"
    );

    if (!nav) {
      console.warn(
        "EDEX navigation bar was not found."
      );

      return;
    }

    const currentPath =
      window.location.pathname.toLowerCase();

    // Build the same five tabs on every
    // Admin page, in exactly the same order.

    const newLinks = GAMES.map(game => {

      const link =
        document.createElement("a");

      link.href = game.url;
      link.textContent = game.name;

      const gamePath =
        new URL(game.url)
          .pathname.toLowerCase();

      if (currentPath === gamePath) {

        link.classList.add("active");

        link.setAttribute(
          "aria-current",
          "page"
        );
      }

      return link;
    });

    // Replace old navigation links.
    // This does NOT replace the dashboard.

    nav.replaceChildren(...newLinks);

    // Create one responsive style.

    if (!document.getElementById(
      "edex-five-games-style"
    )) {

      const style =
        document.createElement("style");

      style.id =
        "edex-five-games-style";

      style.textContent = `

        nav.edex-tabs,
        nav.tabs {
          display: grid !important;

          grid-template-columns:
            repeat(5, minmax(0, 1fr)) !important;

          gap: 9px !important;
          width: 100%;
        }

        nav.edex-tabs a,
        nav.tabs a {
          display: flex !important;

          justify-content: center;
          align-items: center;

          min-width: 0;
          min-height: 55px;

          padding: 12px 7px;

          border-radius: 12px;

          border: 1px solid #80649b;

          background: #49345f;
          color: #ffffff;

          font-family:
            Arial, sans-serif;

          font-size: 12px;
          font-weight: 900;

          text-align: center;
          text-decoration: none;

          overflow-wrap: anywhere;
        }

        nav.edex-tabs a:hover,
        nav.tabs a:hover {
          background: #665080;
        }

        nav.edex-tabs a.active,
        nav.tabs a.active {
          background:
            linear-gradient(
              110deg,
              #ffe4a6,
              #edbf6c
            ) !important;

          border-color: #ffe4a6;

          color: #28190a !important;
        }

        @media (max-width: 950px) {

          nav.edex-tabs,
          nav.tabs {

            grid-template-columns:
              repeat(2, minmax(0, 1fr))
              !important;
          }

        }

        @media (max-width: 480px) {

          nav.edex-tabs a,
          nav.tabs a {

            font-size: 11px;
            padding: 10px 5px;
          }

        }
      `;

      document.head.appendChild(style);
    }

    console.log(
      "EDEX: All five Admin tabs loaded."
    );
  }

  // Run after the page is ready.

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      buildNavigation,
      { once: true }
    );

  } else {

    buildNavigation();
  }

})();
