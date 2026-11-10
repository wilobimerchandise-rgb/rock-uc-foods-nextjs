import React from 'react';

/**
 * ROCK UC FOODS - Phase 2B Menu Motion Keyframes & Stylesheet
 * Playbook v9 Section 26.1 Item 4
 *
 * Rules:
 * - Slide-in keyframes animate ONLY transform and opacity:
 *   0% translateY(44px) opacity 0;
 *   55% translateY(-9px) opacity 1;
 *   75% translateY(4px);
 *   100% translateY(0);
 *   Duration 0.75s.
 * - Warm pulse glow (3.2s alternate, radial gold/amber glow).
 * - Three steam wisps (2.8s rising, delays 0s, 0.9s, 1.7s).
 * - prefers-reduced-motion: reduce switches off slide, bounce, glow and steam completely.
 */

export function MenuMotionStyles() {
  return (
    <style
      id="rock-uc-foods-motion-styles"
      dangerouslySetInnerHTML={{
        __html: `
@keyframes slideBounce {
  0% {
    opacity: 0;
    transform: translateY(44px);
  }
  55% {
    opacity: 1;
    transform: translateY(-9px);
  }
  75% {
    opacity: 1;
    transform: translateY(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes warmPulseGlow {
  0% {
    opacity: 0.2;
    transform: scale(0.96);
  }
  100% {
    opacity: 0.55;
    transform: scale(1.04);
  }
}

@keyframes steamRise {
  0% {
    opacity: 0;
    transform: translateY(0) scaleX(0.9);
  }
  25% {
    opacity: 0.55;
  }
  65% {
    opacity: 0.25;
    transform: translateY(-16px) scaleX(1.3);
  }
  100% {
    opacity: 0;
    transform: translateY(-28px) scaleX(1.6);
  }
}

.dish-card-motion-init {
  opacity: 0;
  transform: translateY(44px);
}

.dish-card-motion-play {
  animation: slideBounce 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.dish-heat-glow {
  animation: warmPulseGlow 3.2s ease-in-out infinite alternate;
}

.dish-steam-wisp-1 {
  animation: steamRise 2.8s ease-out infinite;
  animation-delay: 0s;
}

.dish-steam-wisp-2 {
  animation: steamRise 2.8s ease-out infinite;
  animation-delay: 0.9s;
}

.dish-steam-wisp-3 {
  animation: steamRise 2.8s ease-out infinite;
  animation-delay: 1.7s;
}

@media (prefers-reduced-motion: reduce) {
  .dish-card-motion-init,
  .dish-card-motion-play,
  .dish-heat-glow,
  .dish-steam-wisp-1,
  .dish-steam-wisp-2,
  .dish-steam-wisp-3 {
    animation: none !important;
    transition: none !important;
    transform: none !important;
    opacity: 1 !important;
  }
  .dish-steam-container {
    display: none !important;
  }
}
`,
      }}
    />
  );
}
