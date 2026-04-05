import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MediaUploadButton — paperclip button that triggers file picker.
 * On file select: compresses images, uploads via presigned URL,
 * then emits a message:send with the media URL + metadata.
 */
import { useRef, useState } from "react";
import { useMediaUpload } from "../../hooks/useMediaUpload";
import { emitSendMessage } from "../../socket/socket.events";
import styles from "./MediaUploadButton.module.scss";
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
const CATEGORY_TO_TYPE = {
    image: "image",
    audio: "audio",
    video: "video",
    document: "document",
};
const MediaUploadButton = ({ conversationId, disabled }) => {
    const inputRef = useRef(null);
    const { upload, state } = useMediaUpload();
    const [error, setError] = useState(null);
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
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
        if (inputRef.current)
            inputRef.current.value = "";
    };
    return (_jsxs("div", { className: styles.wrap, children: [_jsx("input", { ref: inputRef, type: "file", accept: ACCEPT, className: styles.hiddenInput, onChange: handleFileChange, disabled: disabled || state.isUploading }), _jsx("button", { className: styles.btn, onClick: () => inputRef.current?.click(), disabled: disabled || state.isUploading, title: "Attach file", children: state.isUploading ? (_jsxs("span", { className: styles.progress, children: [state.progress, "%"] })) : (_jsx("span", { className: styles.icon, children: "\uD83D\uDCCE" })) }), error && _jsx("div", { className: styles.error, children: error })] }));
};
export default MediaUploadButton;
