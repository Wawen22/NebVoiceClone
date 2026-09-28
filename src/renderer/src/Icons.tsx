type IconName = 'console' | 'settings' | 'diagnostics' | 'play' | 'stop' | 'replay' | 'external' | 'speaker' | 'mute' | 'upload' | 'mic' | 'copy' | 'refresh' | 'close'

const paths: Record<IconName, React.ReactNode> = {
  console: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M9 9h12" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l-1.86 1.86a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21h-2.64v-1.04a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-1.86-1.86A1.7 1.7 0 0 0 7.96 15a1.7 1.7 0 0 0-1.56-1H5v-2.64h1.4a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.88l1.86-1.86a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.56V4h2.64v1.4a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l1.86 1.86a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1H21V14h-.04a1.7 1.7 0 0 0-1.56 1Z" /></>,
  diagnostics: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  play: <path d="m8 5 11 7-11 7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  replay: <><path d="M3 11a9 9 0 1 1 2 7M3 17v-6h6" /></>,
  external: <><path d="M7 17 17 7M8 7h9v9" /></>,
  speaker: <><path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12" /></>,
  mute: <><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6" /></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5" /></>,
  close: <path d="M5 5 19 19M19 5 5 19" />
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }): React.JSX.Element {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}