
/*
 EDEX FIVE GAME NAVIGATION

 Correct filenames:
 hitbox.html
 hitbox-admin.html
 hitbox.js

 Navigation file:
 edex fifth tab.js
*/

(() => {
  "use strict";

  const HITBOX_URL =
    "https://freshlook10-alt.github.io/Edex-Word-Portal/hitbox-admin.html";

  function setupNavigation() {

    const nav = document.querySelector(
      "nav.edex-tabs, nav.tabs"
    );

    if (!nav) return;

    const links = Array.from(
      nav.querySelectorAll("a")
    );

    let hitbox = links.find(link => {
      const url = link.getAttribute("href") || "";
      const label = link.textContent || "";

      return (
        /hit-?box-admin\.html/i.test(url) ||
        /hit the box/i.test(label)
      );
    });

    // Create the fifth tab if missing.

    if (!hitbox) {
      hitbox = document.createElement("a");
      nav.appendChild(hitbox);
    }

    // Fix the incorrect link.

    hitbox.href = HITBOX_URL;
    hitbox.textContent = "🎯 Hit the Box";

    // Highlight Hit the Box when selected.

    if (
      window.location.pathname.endsWith(
        "/hitbox-admin.html"
      )
    ) {
      nav.querySelectorAll("a").forEach(link => {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      });

      hitbox.classList.add("active");
      hitbox.setAttribute("aria-current", "page");
    }

    // Arrange five tabs neatly.

    if (!document.getElementById("edex-nav-style")) {
      const style = document.createElement("style");

      style.id = "edex-nav-style";

      style.textContent = `
        nav.edex-tabs,
        nav.tabs {
          display: grid !important;
          grid-template-columns:
            repeat(5, minmax(0, 1fr)) !important;
          gap: 9px !important;
        }

        nav.edex-tabs a,
        nav.tabs a {
          min-width: 0;
          text-align: center;
          overflow-wrap: anywhere;
        }

        @media (max-width: 850px) {
          nav.edex-tabs,
          nav.tabs {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `;

      document.head.appendChild(style);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setupNavigation,
      { once: true }
    );
  } else {
    setupNavigation();
  }

})();
