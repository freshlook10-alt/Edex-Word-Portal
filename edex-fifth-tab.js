
/*
 EDEX FIFTH GAME NAVIGATION

 Adds Hit the Box as the fifth tab
 to the existing four Admin pages.

 Does not change Firebase, visitor
 records, timers or chocolate counters.
*/

(() => {
  "use strict";

  const HIT_BOX_ADMIN =
    "https://freshlook10-alt.github.io/Edex-Word-Portal/hit-box-admin.html";

  function addFifthTab() {
    const nav = document.querySelector(
      "nav.edex-tabs, nav.tabs"
    );

    if (!nav) return;

    const alreadyExists = Array.from(
      nav.querySelectorAll("a")
    ).some(link =>
      link.href.includes("/hit-box-admin.html")
    );

    if (!alreadyExists) {
      const link = document.createElement("a");

      link.href = HIT_BOX_ADMIN;
      link.textContent = "🎯 Hit the Box";

      if (
        window.location.pathname.endsWith(
          "/hit-box-admin.html"
        )
      ) {
        link.classList.add("active");
        link.setAttribute("aria-current","page");
      }

      nav.appendChild(link);
    }

    if (!document.getElementById("edex-five-tab-style")) {
      const style = document.createElement("style");

      style.id = "edex-five-tab-style";

      style.textContent = `
        @media (min-width:961px) {
          nav.edex-tabs,
          nav.tabs {
            display:grid !important;
            grid-template-columns:
              repeat(5,minmax(0,1fr)) !important;
            gap:9px !important;
          }

          nav.edex-tabs a,
          nav.tabs a {
            min-width:0;
            text-align:center;
            overflow-wrap:anywhere;
          }
        }

        @media (max-width:960px) {
          nav.edex-tabs,
          nav.tabs {
            display:grid !important;
            grid-template-columns:
              repeat(2,minmax(0,1fr)) !important;
            gap:8px !important;
          }
        }
      `;

      document.head.appendChild(style);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      addFifthTab,
      {once:true}
    );
  } else {
    addFifthTab();
  }
})();
