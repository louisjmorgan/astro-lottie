import type { AnimationItem } from "lottie-web";
import type { LottieAnimation, LottieAnimationConfig } from "./types";

setTimeout(async () => {
  const DEFAULT: Partial<LottieAnimationConfig> = {
    player: "light",
    loop: true,
    autoplay: "visible",
    visibleThreshold: 0,
  };

  const containers = [...document.querySelectorAll("[data-lottie]")]
    .map((x) => {
      try {
        return [
          x,
          {
            ...DEFAULT,
            ...JSON.parse(x.getAttribute("data-lottie-data") || ""),
          },
        ];
      } catch (err) {
        console.warn("Cannot parse lottie animation data", x);
      }
    })
    .filter((x) => !!x) as [HTMLElement, LottieAnimationConfig][];

  if (containers.length === 0) {
    // no lottie animation return
    return;
  }

  const isFull = containers.some(([, config]) => config.player === "full");
  const lottie = await (isFull
    ? import("lottie-web")
    : import("lottie-web/build/player/lottie_light")
  )
    .then((x) => x.default)
    .catch((err) => {
      console.warn("Cannot load lottie-web script", err);
    });

  if (!lottie) {
    return;
  }

  // load animations
  const animationDataMap = new Map(
    (
      await Promise.all(
        [...new Set(containers.map(([_, config]) => config.src))].map(
          async (src) => {
            const response = await fetch(src).catch(() => {});
            if (!response || response.status >= 400) {
              console.warn("Cannot load animation(%s)", src);
              return;
            }

            const data = await response.json().catch(() => {});
            if (!data) {
              console.warn("Cannot load animation(%s)", src);
              return;
            }

            return [src, data] as const;
          }
        )
      )
    ).filter((x) => !!x) as [string, any][]
  );

  const animations = containers.map(([container, config]) => {
    const id = config.id || `A${Math.random().toFixed(6).substring(2)}`;

    const animationData = animationDataMap.get(config.src);
    let player: AnimationItem | undefined;
    if (animationData) {
      const { loop, autoplay, rendererSettings } = config;
      player = lottie.loadAnimation({
        container,
        loop,
        autoplay: autoplay === "visible" ? false : autoplay,
        animationData,
        rendererSettings: {
          viewBoxOnly: true,
          ...rendererSettings,
        },
      });
    }

    return Object.freeze({
      id,
      config,
      container,
      isLoaded: !!player,
      player,
    }) as LottieAnimation;
  });

  const toObserve = animations.filter(
    (x) => x.isLoaded && x.config.autoplay === "visible"
  );
  if (toObserve.length > 0) {
    // pick the min threshold as the common for all animations
    const threshold = toObserve.reduce(
      (r, x) => Math.max(0, Math.min(x.config.visibleThreshold || 0, r)),
      1
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((x) => {
          const animation = animations.find((y) => y.container === x.target);
          if (animation && animation.isLoaded) {
            if (x.isIntersecting && x.intersectionRatio >= threshold) {
              animation.player.play();
            } else {
              animation.player.pause();
            }
          }
        });
      },
      { threshold }
    );

    toObserve.forEach((x) => {
      observer.observe(x.container);
    });
  }

  //assign as global object
  window.lottie = lottie;
  window.astroLottie = {
    getAllAnimations() {
      return animations.slice();
    },
    getAnimation(key) {
      if (typeof key === "string") {
        return animations.find((x) => x.id === key);
      } else if (typeof key === "object") {
        if ("container" in key) {
          return animations.find((x) => x.container === key.container);
        } else if ("elementId" in key) {
          return animations.find((x) => x.container.id === key.elementId);
        }
      }
      throw new Error("Invalid LottieAnimation source: " + key);
    },
  };

  // raise custom ready event
  document.dispatchEvent(
    new CustomEvent("astro-lottie-loaded", {
      detail: window.astroLottie!,
    })
  );
}, 0);
