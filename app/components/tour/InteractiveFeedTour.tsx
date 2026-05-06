"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

/** Legacy browser-only tour flag; cleared after server marks completion. */
const LEGACY_LS_PREFIX = "peaksees:feed-driver-tour:v1:";

function elExists(sel: string) {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector(sel));
}

function openDrawerThenAdvance(ctx: { driver: Driver }, delayMs = 480) {
  window.dispatchEvent(new CustomEvent("peaksees:tour-open-nav"));
  window.setTimeout(() => {
    ctx.driver.moveNext();
    ctx.driver.refresh();
  }, delayMs);
}

function closeDrawerThenAdvance(ctx: { driver: Driver }, delayMs = 380) {
  window.dispatchEvent(new CustomEvent("peaksees:tour-close-nav"));
  window.setTimeout(() => {
    ctx.driver.moveNext();
    ctx.driver.refresh();
  }, delayMs);
}

export function InteractiveFeedTour({
  userId,
  displayName,
  tourCompletedOnServer,
}: {
  userId: string;
  displayName: string;
  /** Persisted per user (Postgres/SQLite) so the tour is once per account, not per browser. */
  tourCompletedOnServer: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (tourCompletedOnServer) {
      try {
        window.localStorage.removeItem(`${LEGACY_LS_PREFIX}${userId}`);
      } catch {
        // ignore
      }
      return undefined;
    }

    let cancelled = false;
    let outerTimer: number | undefined;
    let innerTimer: number | undefined;
    let drv: Driver | undefined;

    try {
      window.localStorage.removeItem(`${LEGACY_LS_PREFIX}${userId}`);
    } catch {
      // ignore
    }

    const requiredSelectors = [
      '[data-tour="tour-header-banner"]',
      '[data-tour="nav-menu"]',
      '[data-tour="nav-peakpoints"]',
      '[data-tour="feed-tabs"]',
      '[data-tour="feed-explore"]',
      '[data-tour="feed-scroll"]',
      '[data-tour="tour-first-card"]',
      '[data-tour="market-trade-box"]',
      '[data-tour="peak-badge"]',
      '[data-tour="compose-fab"]',
    ];

    outerTimer = window.setTimeout(() => {
      if (cancelled) return;
      window.dispatchEvent(new CustomEvent("peaksees:tour-show-feed-chrome"));
      window.dispatchEvent(new CustomEvent("peaksees:tour-close-nav"));

      innerTimer = window.setTimeout(() => {
        if (cancelled) return;
        for (const sel of requiredSelectors) {
          if (!elExists(sel)) {
            return;
          }
        }

        const name =
          displayName.trim().length >= 2 ? displayName.trim().split(/\s+/)[0] : "there";

        const steps: DriveStep[] = [
          {
            element: '[data-tour="tour-header-banner"]',
            popover: {
              title: `Welcome to peaksees, ${name}`,
              description:
                "This strip keeps you oriented—the logo snaps you back home. Follow the arrows to tour navigation, markets, and composing peaks.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="nav-menu"]',
            popover: {
              title: "Navigation drawer",
              description:
                "Hammer icon opens shortcuts to Peakpoints, bookmarks, mentions, Peakstats, and billing. Tap Next and we’ll pop it open for you.",
              side: "bottom",
              align: "start",
              onNextClick: (_element, _step, ctx) => {
                openDrawerThenAdvance(ctx, 460);
              },
            },
          },
          {
            element: '[data-tour="nav-peakpoints"]',
            popover: {
              title: "Peakpoints wallet",
              description:
                "Stripe top-ups settle here quickly (give it ~60s after returning from checkout); withdrawals piggyback on the same tools.",
              side: "right",
              align: "start",
              onNextClick: (_element, _step, ctx) => {
                closeDrawerThenAdvance(ctx, 380);
              },
            },
            onHighlightStarted: (_element, _step, ctx) => {
              window.dispatchEvent(new CustomEvent("peaksees:tour-open-nav"));
              window.setTimeout(() => ctx.driver.refresh(), 460);
            },
          },
          {
            element: '[data-tour="feed-tabs"]',
            popover: {
              title: "Feed lanes",
              description:
                "Cycle For you vs Following vs Live—think algorithmic remix, people you watch, or the broadcast rail.",
              side: "bottom",
              align: "center",
            },
            onHighlightStarted: () => {
              window.dispatchEvent(new CustomEvent("peaksees:tour-close-nav"));
              window.dispatchEvent(new CustomEvent("peaksees:tour-show-feed-chrome"));
            },
          },
          {
            element: '[data-tour="feed-explore"]',
            popover: {
              title: "Topic filters",
              description:
                "Trending resets everything. Culture/News/Sports steer autogeneration, and tiny pills sharpen to subtopics like NBA or elections.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="feed-scroll"]',
            popover: {
              title: "Scroll runway",
              description:
                "This column is your infinite timeline—everything below is interactive market media with live prices.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="tour-first-card"]',
            popover: {
              title: "Market cards",
              description:
                "Creators headline the vibe, hashtags set context, and the marquee ticker summarizes odds + settlement.",
              side: "top",
              align: "center",
            },
            onHighlighted: (element) => {
              element?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
          {
            element: '[data-tour="market-trade-box"]',
            popover: {
              title: "Trade lane",
              description:
                "Dial an amount then tap Buy Yes/Buy No—pricing updates live based on crowds. Spending happens instantly.",
              side: "top",
              align: "center",
            },
            onHighlighted: (element) => {
              element?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
          {
            element: '[data-tour="peak-badge"]',
            popover: {
              title: "peaksees badge",
              description:
                "Place one trade anywhere to unlock it, then tap the badge to peek at Peak AI’s dissent score versus the crowd.",
              side: "bottom",
              align: "center",
            },
            onHighlighted: (element) => {
              element?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
          {
            element: '[data-tour="compose-fab"]',
            popover: {
              title: "Compose",
              description:
                "Orb in the corner opens the peak composer—text, GIFs, video, polls, anything social that isn’t strictly a structured market.",
              side: "top",
              align: "center",
            },
          },
        ];

        drv = driver({
          animate: true,
          smoothScroll: true,
          showProgress: true,
          overlayOpacity: 0.58,
          stagePadding: 10,
          stageRadius: 12,
          allowClose: true,
          overlayClickBehavior: "nextStep",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Finish",
          popoverOffset: 12,
          onDestroyed: () => {
            void (async () => {
              try {
                await fetch("/api/feed-interactive-tour/complete", {
                  method: "POST",
                });
              } catch {
                // still refresh so middleware/session can converge on retries
              } finally {
                try {
                  window.localStorage.removeItem(`${LEGACY_LS_PREFIX}${userId}`);
                } catch {
                  // ignore
                }
                router.refresh();
              }
            })();
          },
          steps,
        });

        try {
          drv.drive();
        } catch {
          drv.destroy?.();
        }
      }, 420);
    }, 760);

    return () => {
      cancelled = true;
      if (outerTimer !== undefined) window.clearTimeout(outerTimer);
      if (innerTimer !== undefined) window.clearTimeout(innerTimer);
      drv?.destroy();
    };
  }, [userId, displayName, tourCompletedOnServer, router]);

  return null;
}
