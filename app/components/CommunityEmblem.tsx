/** A single open book and a star: knowledge held in common. */
export function CommunityEmblem({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={compact ? "community-emblem compact" : "community-emblem"}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="m48 10 3.7 8 8.8 1-6.5 6 1.8 8.6-7.8-4.4-7.8 4.4L42 25l-6.5-6 8.8-1z"
        fill="currentColor"
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 40q18-6 36 5 18-11 36-5v35q-18-6-36 5-18-11-36-5zM48 45v35" />
        <path
          d="M22 51q8-1 17 3m-17 9q8-1 17 3m18-12q9-4 17-3m-17 15q9-4 17-3"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
