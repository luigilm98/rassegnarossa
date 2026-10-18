/** Original vector seal: knowledge, solidarity, music and connected communities. */
export function CommunityEmblem({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 420 420"
      className={compact ? "community-emblem compact" : "community-emblem"}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="210"
        cy="210"
        r="190"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="210"
        cy="210"
        r="178"
        fill="none"
        stroke="currentColor"
        strokeWidth=".7"
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="210" cy="192" r="117" opacity=".32" />
        <ellipse cx="210" cy="192" rx="64" ry="117" opacity=".25" />
        <path d="M95 167h230M95 216h230M210 75v233" opacity=".25" />
        <path
          d="M115 99c-72 80-63 188 44 238M305 99c72 80 63 188-44 238"
          strokeWidth="4"
        />
      </g>
      <g fill="currentColor">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i} transform={`rotate(${i * 13 - 30} 210 210)`}>
            <ellipse
              cx="66"
              cy="210"
              rx="9"
              ry="23"
              transform="rotate(-34 66 210)"
            />
            <ellipse
              cx="354"
              cy="210"
              rx="9"
              ry="23"
              transform="rotate(34 354 210)"
            />
          </g>
        ))}
        <path d="m210 41 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" />
      </g>
      <g
        fill="var(--paper, #f6f3ec)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M132 250q39-21 78 0 39-21 78 0v62q-39-21-78 0-39-21-78 0z" />
        <path
          d="M210 250v62M146 263q25-10 50 0m-50 14q25-10 50 0m28-14q25-10 50 0m-50 14q25-10 50 0"
          strokeWidth="2"
        />
        <rect x="168" y="103" width="84" height="53" rx="5" />
        <path d="M159 167h102l-9-11h-84zM192 130l11 10 24-24M210 167v17m-39 9h78m-78 0v11m78-11v11" />
      </g>
      <g
        fill="var(--paper, #f6f3ec)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <circle cx="165" cy="214" r="12" />
        <circle cx="210" cy="205" r="15" />
        <circle cx="255" cy="217" r="10" />
        <path d="M144 249q0-24 21-23 17 0 23 18m-2-1q0-23 24-23t25 23m-4 1q8-18 24-15 17 0 19 20" />
        <path d="M144 234l-11-7m144 9 12-6" />
      </g>
      <g fill="currentColor">
        <path d="M120 139v28c-16-7-22 10-9 12 7 1 14-3 14-10v-20l17-5v16c-16-7-22 10-9 12 7 1 14-3 14-10v-33z" />
        <path d="M293 129v28c-16-7-22 10-9 12 7 1 14-3 14-10v-19l16 5v-9z" />
        <path d="M210 349c-30-24-41-8-25 5l25 19 25-19c16-13 5-29-25-5z" />
      </g>
    </svg>
  );
}
