interface IconProps {
  size?: number;
  className?: string;
}

const svg = (path: string) =>
  function Icon({ size = 15, className = '' }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  };

export const KeyIcon = svg(
  'M12.65 10a6 6 0 1 0-.13 4.03l.13-.03H15v3h3v-3h3v-4H12.65zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
);

export const DocumentIcon = svg(
  'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z',
);

export const IdIcon = svg(
  'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4V6h16v12zM9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 4H5v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1zm2-7h4v1.5h-4V9zm0 3h4v1.5h-4V12z',
);

export const AttachIcon = svg(
  'M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z',
);

export const LinkIcon = svg(
  'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
);

export const FolderIcon = svg(
  'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z',
);

export const PencilIcon = svg(
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
);

export const TrashIcon = svg(
  'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
);

export const CloseIcon = svg(
  'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z',
);

export const PowerIcon = svg(
  'M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 1 1-11.41-5.42L6.17 5.17A9 9 0 1 0 21 12a8.94 8.94 0 0 0-3.17-6.83z',
);

export const WarningIcon = svg(
  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
);
