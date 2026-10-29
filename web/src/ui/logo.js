// "AuctionIQ" wordmark: Bricolage Grotesque text whose Q tail is a raised brass bid paddle.
// The same Q mark (bowl + paddle) is the favicon (public/favicon.svg) and the loader logo (index.html).

export const qMark = () => `<svg class="logo-q" viewBox="0 0 130 100" aria-hidden="true" focusable="false">
  <ellipse cx="45" cy="50" rx="36" ry="38" fill="none" stroke="currentColor" stroke-width="16"/>
  <g class="logo-paddle">
    <circle cx="111" cy="43" r="15" stroke-width="7"/>
    <path d="M68 79 L101 52" stroke-width="10.5" stroke-linecap="round"/>
  </g>
</svg>`;

export const logoHTML = (cls = '') =>
  `<span class="logo ${cls}" role="img" aria-label="AuctionIQ"><span class="logo-word" aria-hidden="true">AuctionI</span>${qMark()}</span>`;
