/**
 * MediaUploadButton — paperclip button that triggers file picker.
 * On file select: compresses images, uploads via presigned URL,
 * then emits a message:send with the media URL + metadata.
 */

import React, { useRef, useState } from "react";
import { useMediaUpload } from "../../hooks/useMediaUpload";
import { useChatStore } from "../../store/chat.store";
import { emitSendMessage } from "../../socket/socket.events";
import styles from "./MediaUploadButton.module.scss";

interface Props {
  conversationId: string;
  disabled?: boolean;
}

const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

type MessageType = "image" | "audio" | "video" | "document";

const CATEGORY_TO_TYPE: Record<string, MessageType> = {
  image: "image",
  audio: "audio",
  video: "video",
  document: "document",
};

const MediaUploadButton: React.FC<Props> = ({ conversationId, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, state } = useMediaUpload();
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const result = await upload(file);
    if (!result) {
      setError(state.error ?? "Upload failed");
      return;
    }

    // Send message via WebSocket with media content
    await emitSendMessage({
      conversationId,
      type: CATEGORY_TO_TYPE[result.category] ?? "document",
      content: {
        url: result.publicUrl,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
        originalName: result.originalName,
      },
    });

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className={styles.hiddenInput}
        onChange={handleFileChange}
        disabled={disabled || state.isUploading}
      />
      <button
        className={styles.btn}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || state.isUploading}
        title="Attach file"
      >
        {state.isUploading ? (
          <span className={styles.progress}>{state.progress}%</span>
        ) : (
          <span className={styles.icon}>📎</span>
        )}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default MediaUploadButton;
