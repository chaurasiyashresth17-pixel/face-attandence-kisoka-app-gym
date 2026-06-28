/**
 * Configuration constants for Face Attendance Kiosk
 */

// Optimized input size for TinyFaceDetector (Allowed values: 160, 224, 320)
// Lower values (e.g. 160) are faster but require the face to be closer/larger in the frame.
export const FACE_API_INPUT_SIZE = 160;

// Voice Feedback Settings
export const VOICE_ENABLED = true;
export const VOICE_LANGUAGE = "en-IN";
export const VOICE_RATE = 1;
export const VOICE_PITCH = 1;
export const VOICE_VOLUME = 1;
