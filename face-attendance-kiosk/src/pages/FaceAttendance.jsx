import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  addDoc,
  doc,
} from 'firebase/firestore';
import * as faceapi from 'face-api.js';
import { db } from '../firebase/config';
import { useFaceApi } from '../hooks/useFaceApi';
import { useCamera } from '../hooks/useCamera';
import FaceBox from '../components/FaceBox';
import StatusOverlay from '../components/StatusOverlay';
import LoadingScreen from '../components/LoadingScreen';
import { findBestMatch, isValidDescriptor } from '../utils/faceUtils';
import { getLocalDateString } from '../utils/dateUtils';
import {
  FACE_API_INPUT_SIZE,
  VOICE_ENABLED,
  VOICE_LANGUAGE,
  VOICE_RATE,
  VOICE_PITCH,
  VOICE_VOLUME
} from '../utils/constants';
import './FaceAttendance.css';

const MATCH_THRESHOLD = 0.5;
const COOLDOWN_MS = 5000;

export default function FaceAttendance() {
  const navigate = useNavigate();
  const { modelsLoaded, loadingProgress, error: modelError } = useFaceApi();

  // Camera
  const [cameraActive, setCameraActive] = useState(false);
  const { videoRef, isReady, error: cameraError, stopCamera } = useCamera(cameraActive);

  // Descriptors cache
  const [cachedDescriptors, setCachedDescriptors] = useState([]);
  const [descriptorsLoading, setDescriptorsLoading] = useState(true);
  const [descriptorsError, setDescriptorsError] = useState(null);
  const [descriptorCount, setDescriptorCount] = useState(0);

  // Detection state
  const [detection, setDetection] = useState(null);
  const [boxColor, setBoxColor] = useState('red');
  const [matchedMember, setMatchedMember] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('idle'); // idle | checking | checked_in | already_in | no_match | multi_face | denied
  const [statusMessage, setStatusMessage] = useState('Point camera at your face...');
  const [denialReason, setDenialReason] = useState(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const cooldownMap = useRef(new Map()); // memberId -> timestamp
  const todayAttendanceSet = useRef(new Set()); // memberId -> true
  const freezeRef = useRef(false);
  const lastNotFoundVoiceRef = useRef(0);

  // Audio functions
  const speakMessage = useCallback((message) => {
    if (!VOICE_ENABLED || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = VOICE_RATE;
    utterance.pitch = VOICE_PITCH;
    utterance.volume = VOICE_VOLUME;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(v => v.lang === VOICE_LANGUAGE) || voices.find(v => v.lang.startsWith('en'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  }, []);
  const playSuccessChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.error(e); }
  }, []);

  const playBuzzerSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, ctx.currentTime);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc2.stop(ctx.currentTime + 0.3);
      }, 150);
    } catch (e) { console.error(e); }
  }, []);

  // Start camera only after models are loaded to avoid ref race conditions
  useEffect(() => {
    if (modelsLoaded && !modelError) {
      setCameraActive(true);
    }
  }, [modelsLoaded, modelError]);

  // Load all face-registered members and staff
  const loadDescriptors = useCallback(async () => {
    setDescriptorsLoading(true);
    setDescriptorsError(null);
    try {
      const [memberSnap, staffSnap] = await Promise.all([
        getDocs(query(collection(db, 'members'), where('faceRegistered', '==', true))),
        getDocs(query(collection(db, 'staff'), where('faceRegistered', '==', true)))
      ]);

      const descriptors = [];
      let skipped = 0;

      memberSnap.docs.forEach((d) => {
        const data = d.data();
        if (!data.faceDescriptor || !isValidDescriptor(data.faceDescriptor)) {
          skipped++;
          return;
        }
        descriptors.push({
          member: { id: d.id, ...data, profileType: 'member' },
          descriptor: data.faceDescriptor,
        });
      });

      staffSnap.docs.forEach((d) => {
        const data = d.data();
        if (!data.faceDescriptor || !isValidDescriptor(data.faceDescriptor)) {
          skipped++;
          return;
        }
        descriptors.push({
          member: { id: d.id, ...data, profileType: 'staff' },
          descriptor: data.faceDescriptor,
        });
      });

      if (skipped > 0) {
        console.warn(`[FaceAttendance] Skipped ${skipped} profiles with invalid descriptors`);
      }

      // Also preload today's attendance to avoid querying Firebase repeatedly
      const today = getLocalDateString();
      const attendanceSnap = await getDocs(
        query(collection(db, 'attendance'), where('attendance_date', '==', today))
      );
      const attSet = new Set();
      attendanceSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const pType = data.type === 'staff' ? 'staff' : 'member';
        attSet.add(`${pType}_${data.member_id}_${today}`);
      });
      todayAttendanceSet.current = attSet;

      setCachedDescriptors(descriptors);
      setDescriptorCount(descriptors.length);
    } catch (err) {
      console.error('[FaceAttendance] Load descriptors failed:', err);
      setDescriptorsError(`Failed to load face data: ${err.message}`);
    } finally {
      setDescriptorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDescriptors();
  }, [loadDescriptors]);

  // Update canvas dimensions on video ready
  useEffect(() => {
    if (isReady && videoRef.current) {
      const updateSize = () => {
        const rect = videoRef.current?.getBoundingClientRect();
        if (rect) setDimensions({ width: rect.width, height: rect.height });
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [isReady, videoRef]);

  // Main face scanning loop
  useEffect(() => {
    if (!isReady || !modelsLoaded || descriptorsLoading || !cameraActive) return;
    if (cachedDescriptors.length === 0) {
      setStatusMessage('No registered faces found. Register members first.');
      return;
    }

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: FACE_API_INPUT_SIZE,
      scoreThreshold: 0.5,
    });

    let isProcessing = false;
    let animationFrameId;
    let isActive = true;

    async function detectLoop() {
      if (!isActive) return;

      // Skip processing if frozen, but keep loop alive
      if (freezeRef.current) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      if (!isProcessing && videoRef.current && videoRef.current.readyState >= 2) {
        isProcessing = true;
        try {
          // Detect all faces to check for multiple people
          const allDetections = await faceapi.detectAllFaces(videoRef.current, options);

          if (!isActive) return;

          if (allDetections.length === 0) {
            setDetection(null);
            setBoxColor('red');
            setMatchedMember(null);
            setAttendanceStatus('idle');
            setStatusMessage('Point camera at your face...');
          } else if (allDetections.length > 1) {
            setDetection(null);
            setBoxColor('red');
            setMatchedMember(null);
            setAttendanceStatus('multi_face');
            setStatusMessage('Only one face at a time');
          } else {
            // Single face — get full descriptor
            const result = await faceapi
              .detectSingleFace(videoRef.current, options)
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!isActive) return;

            if (!result) {
              setDetection(null);
              setBoxColor('red');
              setMatchedMember(null);
              setAttendanceStatus('idle');
              setStatusMessage('Point camera at your face...');
            } else {
              setDetection(result);
              setAttendanceStatus('checking');
              setStatusMessage('Identifying...');

              // Match against cache
              const match = findBestMatch(result.descriptor, cachedDescriptors, MATCH_THRESHOLD);

              if (!match) {
                setBoxColor('red');
                setMatchedMember(null);
                setAttendanceStatus('no_match');
                setStatusMessage('Face Not Found');

                const now = Date.now();
                if (now - lastNotFoundVoiceRef.current > 5000) {
                  speakMessage("Face not found");
                  lastNotFoundVoiceRef.current = now;
                }
              } else {
                const { member } = match;

                // Check cooldown
                const matchKey = `${member.profileType}_${member.id}_${getLocalDateString()}`;
                const lastSeen = cooldownMap.current.get(matchKey);
                if (lastSeen && Date.now() - lastSeen < COOLDOWN_MS) {
                  setBoxColor('green');
                  setMatchedMember(member);
                } else {
                  setBoxColor('green');
                  setMatchedMember(member);
                  cooldownMap.current.set(matchKey, Date.now());

                  // Check / create attendance record (fire and forget)
                  handleAttendance(member).catch(e => console.error(e));
                }
              }
            }
          }
        } catch (err) {
          console.error('[FaceAttendance] Scan error:', err);
        } finally {
          isProcessing = false;
        }
      }

      if (isActive) {
        animationFrameId = requestAnimationFrame(detectLoop);
      }
    }

    detectLoop();

    return () => {
      isActive = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isReady, modelsLoaded, descriptorsLoading, cachedDescriptors, cameraActive]);

  const handleAttendance = useCallback(async (member) => {
    try {
      setAttendanceStatus('checking');
      setStatusMessage('Validating membership...');

      const isStaff = member.profileType === 'staff';
      const collectionName = isStaff ? 'staff' : 'members';

      // 1. Live Fetch
      const memberDoc = await getDoc(doc(db, collectionName, member.id));
      if (!memberDoc.exists()) {
        throw new Error(`${isStaff ? 'Staff' : 'Member'} profile not found`);
      }
      const memberData = memberDoc.data();
      const status = memberData.status;

      const duplicateKey = `${member.profileType}_${member.id}_${getLocalDateString()}`;

      // Duplicate check
      if (todayAttendanceSet.current.has(duplicateKey)) {
        freezeRef.current = true;
        speakMessage("Already checked in");
        setAttendanceStatus('already_in');
        setStatusMessage('Already Checked In Today');
        setTimeout(() => {
          setAttendanceStatus('idle');
          freezeRef.current = false;
        }, 3000);
        return;
      }

      if (isStaff) {
        // Validation for Staff
        if (!status) {
          console.warn(`[Staff] Status field missing for ${member.name} (${member.id}). Allowing attendance.`);
        } else if (status !== 'Active') {
          freezeRef.current = true;
          playBuzzerSound();
          setTimeout(() => speakMessage("Access denied"), 300);

          setAttendanceStatus('denied');
          setDenialReason({
            title: 'ACCESS DENIED',
            message: 'Staff Inactive',
            detail: `Status is ${status}`,
            memberData: { ...memberData, member_code: memberData.staff_code }
          });
          setTimeout(() => {
            setAttendanceStatus('idle');
            freezeRef.current = false;
          }, 5000);
          return;
        }

        // Write attendance for staff
        const todayStr = getLocalDateString();
        await addDoc(collection(db, 'attendance'), {
          member_id: member.id,
          type: "staff",
          staff_id: member.id,
          staff_name: memberData.name || 'Unknown',
          staff_code: memberData.staff_code || 'N/A',
          role: memberData.role || 'Staff',
          attendance_date: todayStr,
          check_in_time: new Date().toISOString(),
          timestamp: Date.now(),
          attendance_method: "face_kiosk_staff",
          display_name: `STAFF ${memberData.name || 'Unknown'} (${memberData.staff_code || 'N/A'})`
        });

        todayAttendanceSet.current.add(duplicateKey);

        freezeRef.current = true;
        playSuccessChime();
        setTimeout(() => speakMessage("Staff Attendance Done"), 300);

        setAttendanceStatus('checked_in');
        setStatusMessage('Check-In Successful! ✓');
        setTimeout(() => {
          setAttendanceStatus('idle');
          freezeRef.current = false;
        }, 3000);

      } else {
        // Validation for Member
        const lowerStatus = (status || '').toLowerCase();

        // Check 1: Must be active
        if (lowerStatus !== 'active') {
          freezeRef.current = true;
          playBuzzerSound();
          setTimeout(() => speakMessage("Access denied"), 300);

          setAttendanceStatus('denied');
          setDenialReason({
            title: 'ACCESS DENIED',
            message: 'Membership Inactive',
            detail: `Status is ${status || 'Unknown'}`,
            memberData
          });
          setTimeout(() => {
            setAttendanceStatus('idle');
            freezeRef.current = false;
          }, 5000);
          return;
        }

        // Check 2: Expiry Date (Allow until 23:59:59)
        const expiryDateStr = memberData.plan_end_date || memberData.expiryDate;
        if (expiryDateStr) {
          const today = new Date();
          const expiry = new Date(expiryDateStr);
          expiry.setHours(23, 59, 59, 999);

          if (today > expiry) {
            freezeRef.current = true;
            playBuzzerSound();
            setTimeout(() => speakMessage("Membership expired"), 300);

            setAttendanceStatus('denied');
            setDenialReason({
              title: 'ACCESS DENIED',
              message: 'Membership Expired',
              detail: `Expired on: ${expiryDateStr}`,
              memberData
            });
            setTimeout(() => {
              setAttendanceStatus('idle');
              freezeRef.current = false;
            }, 5000);
            return;
          }
        }

        // Check 3: Pending Dues
        if (memberData.pendingDue && memberData.pendingDue > 0) {
          freezeRef.current = true;
          playBuzzerSound();
          setTimeout(() => speakMessage("Payment due. Please contact reception"), 300);

          setAttendanceStatus('denied');
          setDenialReason({
            title: 'DUES PENDING',
            message: 'Please clear your payment',
            detail: `Outstanding Balance: ₹${memberData.pendingDue}`,
            memberData
          });
          setTimeout(() => {
            setAttendanceStatus('idle');
            freezeRef.current = false;
          }, 5000);
          return;
        }

        // Write attendance for member
        const todayStr = getLocalDateString();
        await addDoc(collection(db, 'attendance'), {
          member_id: member.id,
          attendance_date: todayStr,
          check_in_time: new Date().toISOString(),
          attendance_method: 'face_kiosk',
        });

        todayAttendanceSet.current.add(duplicateKey);

        freezeRef.current = true;
        playSuccessChime();
        setTimeout(() => speakMessage("Member Attendance Done"), 300);

        setAttendanceStatus('checked_in');
        setStatusMessage('Check-In Successful! ✓');
        setTimeout(() => {
          setAttendanceStatus('idle');
          freezeRef.current = false;
        }, 3000);
      }

    } catch (err) {
      console.error('[Attendance] Firebase error:', err);
      setAttendanceStatus('no_match');
      setStatusMessage(`Attendance error: ${err.message}`);
    }
  }, [playBuzzerSound, playSuccessChime, speakMessage]);

  function handleStopCamera() {
    stopCamera();
    setCameraActive(false);
    setDetection(null);
    setMatchedMember(null);
    setAttendanceStatus('idle');
    setStatusMessage('Camera stopped.');
  }

  function handleRefresh() {
    setDetection(null);
    setMatchedMember(null);
    setAttendanceStatus('idle');
    setStatusMessage('Refreshing face data...');
    loadDescriptors();
  }

  // Model loading
  if (!modelsLoaded && !modelError) {
    return <LoadingScreen icon="🤖" message={loadingProgress} />;
  }
  if (modelError) {
    return <LoadingScreen error={modelError} />;
  }

  return (
    <div className="fa-page">
      {/* Full-screen camera */}
      <div className="fa-camera-container">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              className="fa-video"
              autoPlay
              playsInline
              muted
            />

            {/* Face box */}
            {detection && (
              <FaceBox
                detection={detection}
                color={boxColor}
                status={attendanceStatus}
                videoElement={videoRef.current}
                width={dimensions.width}
                height={dimensions.height}
              />
            )}

            {/* BIG Overlay for Already Checked In */}
            {attendanceStatus === 'already_in' && (
              <div className="fa-big-overlay warning-overlay">
                <span className="big-icon">⏱️</span>
                <h1>Already Checked In</h1>
              </div>
            )}

            {/* BIG Overlay for Denied Access */}
            {attendanceStatus === 'denied' && denialReason && (
              <div className="fa-big-overlay danger-overlay">
                <span className="big-icon">❌</span>
                <h1>{denialReason.title}</h1>
                <p className="denial-message">{denialReason.message}</p>
                <div className="denial-details-box">
                  <div className="dd-row">
                    <span>Member:</span> <strong>{denialReason.memberData.name} ({denialReason.memberData.member_code})</strong>
                  </div>
                  <div className="dd-row">
                    <span>Reason:</span> <strong style={{ color: '#ef4444' }}>{denialReason.detail}</strong>
                  </div>
                </div>
                <p className="denial-footer">Please contact reception</p>
              </div>
            )}

            {/* BIG Overlay for Checked In */}
            {attendanceStatus === 'checked_in' && (
              <div className="fa-big-overlay success-overlay">
                <span className="big-icon">✅</span>
                <h1>Check-In Successful!</h1>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="fa-camera-error">
                <span className="fa-error-icon">📵</span>
                <h3>Camera Error</h3>
                <p>{cameraError}</p>
                <button className="fa-btn-secondary" onClick={() => navigate('/')}>
                  Go Back
                </button>
              </div>
            )}

            {/* Loading */}
            {(!isReady || descriptorsLoading) && !cameraError && (
              <div className="fa-loading-overlay">
                <div className="spinner-ring" />
                <p>
                  {!isReady
                    ? 'Starting camera...'
                    : descriptorsLoading
                      ? `Loading ${descriptorCount} face profiles...`
                      : 'Preparing...'}
                </p>
              </div>
            )}

            {/* Descriptors error */}
            {descriptorsError && (
              <div className="fa-camera-error">
                <span className="fa-error-icon">⚠️</span>
                <h3>Face Data Error</h3>
                <p>{descriptorsError}</p>
                <button className="fa-btn-accent" onClick={handleRefresh}>
                  Retry
                </button>
              </div>
            )}

            {/* Scan guides (crosshair) */}
            {isReady && !descriptorsLoading && !cameraError && !descriptorsError && (
              <div className="fa-scan-guide">
                <div className="scan-corner top-left" />
                <div className="scan-corner top-right" />
                <div className="scan-corner bottom-left" />
                <div className="scan-corner bottom-right" />
              </div>
            )}

            {/* Status overlay at bottom */}
            <StatusOverlay
              member={matchedMember}
              status={attendanceStatus}
              statusMessage={statusMessage}
            />

            {/* Top bar */}
            <div className="fa-top-bar">
              <button
                id="btn-fa-back"
                className="fa-top-btn"
                onClick={() => {
                  stopCamera();
                  navigate('/');
                }}
              >
                ← Back
              </button>

              <div className="fa-top-center">
                <span className="fa-scan-badge">
                  <span className="fa-scan-dot" />
                  {descriptorCount} Faces Loaded
                </span>
              </div>

              <button
                id="btn-fa-refresh"
                className="fa-top-btn"
                onClick={handleRefresh}
                title="Refresh face data from Firebase"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Stop camera button */}
            <button
              id="btn-fa-stop"
              className="fa-stop-btn"
              onClick={handleStopCamera}
            >
              ⏹ Stop Camera
            </button>
          </>
        ) : (
          /* Camera stopped state */
          <div className="fa-stopped">
            <div className="stopped-icon">⏹</div>
            <h2 className="stopped-title">Camera Stopped</h2>
            <p className="stopped-desc">Tap below to resume face attendance scanning.</p>
            <button
              id="btn-fa-resume"
              className="fa-btn-accent"
              onClick={() => {
                setCameraActive(true);
                setAttendanceStatus('idle');
                setStatusMessage('Point camera at your face...');
              }}
            >
              ▶ Resume Camera
            </button>
            <button className="fa-btn-secondary" onClick={() => navigate('/')}>
              ← Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
