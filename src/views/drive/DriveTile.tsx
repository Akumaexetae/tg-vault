import { useEffect, useState } from 'react';
import { DocumentIcon, FolderIcon } from '../../components/icons';
import { FOLDER_MIME, type DriveFile } from '../../lib/drive';

interface Props {
  file: DriveFile;
  onOpen: () => void;
}

/**
 * Thumbnails come through the main process rather than an <img src>: Drive's
 * thumbnailLink needs the Authorization header and returns 403 without it.
 */
export function DriveTile({ file, onOpen }: Props) {
  const [thumb, setThumb] = useState<string | null>(null);
  const isFolder = file.mimeType === FOLDER_MIME;
  const isMedia = /^(image|video)\//.test(file.mimeType);

  useEffect(() => {
    let cancelled = false;
    if (!file.thumbnailLink) return;
    window.vaultBridge
      .driveThumbnail(file.id, file.thumbnailLink)
      .then((data) => {
        if (!cancelled) setThumb(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file.id, file.thumbnailLink]);

  return (
    <button className="drive-tile" onClick={onOpen} title={file.name}>
      <div className={`drive-thumb ${isFolder ? 'drive-thumb-folder' : ''}`}>
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : isFolder ? (
          <FolderIcon size={34} />
        ) : isMedia ? (
          <span className="drive-thumb-loading" />
        ) : (
          <DocumentIcon size={30} />
        )}
        {file.mimeType.startsWith('video/') && (
          <span className="drive-play">▶</span>
        )}
      </div>
      <span className="drive-tile-name">{file.name}</span>
    </button>
  );
}
