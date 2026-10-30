// "AuctionIQ" logo: a gavel whose head carries a rising bar chart, traced from the brand icon (1024 px
// grid), beside the wordmark in Bricolage Grotesque with "IQ" in brass. The same mark on an ink tile is
// the favicon (public/favicon.svg), and the loader repeats this markup (index.html).

/** The mark alone. The handle takes the text colour (ink on the light pages; brass on the favicon's tile). */
export const mark = () => `<svg class="logo-mark" viewBox="170 218 614 590" aria-hidden="true" focusable="false">
  <path class="lm-handle" d="M418.7 512.5L188.2 735.3A37 37 0 1 0 241.7 786.6L451.8 550.3Z"/>
  <path class="lm-collar" d="M418.7 512.5L394.6 535.8L430.5 574.3L451.8 550.3Z"/>
  <g class="lm-brass">
    <rect x="420" y="399" width="80" height="85" rx="2"/>
    <rect x="536" y="312.5" width="80" height="171.5" rx="2"/>
    <rect x="651" y="226" width="80" height="258" rx="2"/>
    <path d="M424.6 512H731V591.5A20 20 0 0 1 711 611.5H512.5Z"/>
    <path d="M486 760V747A30 30 0 0 1 516 717H711A30 30 0 0 1 741 747V760Z"/>
    <path d="M453 797.5V782A33 33 0 0 1 486 749H742A33 33 0 0 1 775 782V797.5Z"/>
  </g>
</svg>`;

export const logoHTML = (cls = '') =>
  `<span class="logo ${cls}" role="img" aria-label="AuctionIQ">${mark()}<span class="logo-word" aria-hidden="true">Auction<span class="logo-iq">IQ</span></span></span>`;
