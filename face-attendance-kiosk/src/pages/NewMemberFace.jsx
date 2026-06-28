import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import * as faceapi from 'face-api.js';
import { db } from '../firebase/config';
import { useFaceApi } from '../hooks/useFaceApi';
import { useCamera } from '../hooks/useCamera';
import MemberSearch from '../components/MemberSearch';
import FaceBox from '../components/FaceBox';
import LoadingScreen from '../components/LoadingScreen';
import { FACE_API_INPUT_SIZE } from '../utils/constants';
import './NewMemberFace.css';


export default function NewMemberFace() {
  const navigate = useNavigate();
  const { modelsLoaded, loadingProgress, error: modelError } = useFaceApi();

  // Data State
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'staff'
  const [members, setMembers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // UI state machine: 'search' | 'camera' | 'detecting' | 'saving' | 'success' | 'error'
  const [step, setStep] = useState('search');
  const [selectedMember, setSelectedMember] = useState(null);
  const [detection, setDetection] = useState(null);
  const [boxColor, setBoxColor] = useState('red');
  const [statusMsg, setStatusMsg] = useState('');
  const [pageError, setPageError] = useState(null);

  const cameraActive = step === 'camera' || step === 'detecting' || step === 'saving';
  const { videoRef, isReady, error: cameraError, stopCamera } = useCamera(cameraActive);

  const canvasSize = useRef({ width: 0, height: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const intervalRef = useRef(null);
  const videoContainerRef = useRef(null);

  // Load members and staff from Firestore
  useEffect(() => {
    async function fetchData() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [memberSnap, staffSnap] = await Promise.all([
          getDocs(collection(db, 'members')),
          getDocs(collection(db, 'staff'))
        ]);
        setMembers(memberSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStaffList(staffSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('[Data] Fetch failed:', err);
        setDataError(`Failed to load data: ${err.message}`);
      } finally {
        setDataLoading(false);
      }
    }
    fetchData();
  }, []);

  // Update canvas dimensions when video is ready
  useEffect(() => {
    if (isReady && videoRef.current) {
      const updateSize = () => {
        const rect = videoRef.current?.getBoundingClientRect();
        if (rect) {
          setDimensions({ width: rect.width, height: rect.height });
          canvasSize.current = { width: rect.width, height: rect.height };
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [isReady, videoRef]);

  // Start face detection when camera is ready and models loaded
  useEffect(() => {
    if (!isReady || !modelsLoaded || step !== 'detecting') return;

    setStatusMsg('Position your face in the frame...');

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_API_INPUT_SIZE, scoreThreshold: 0.5 });

    let isProcessing = false;
    let animationFrameId;
    let isActive = true;

    async function detectLoop() {
      if (!isActive) return;

      if (!isProcessing && videoRef.current && videoRef.current.readyState >= 2) {
        isProcessing = true;
        try {
          // Detect all faces first to ensure exactly one person is in frame
          const allFaces = await faceapi.detectAllFaces(videoRef.current, options);

          if (!isActive) return;

          if (allFaces.length === 0) {
            setDetection(null);
            setBoxColor('red');
            setStatusMsg('No face detected. Center your face...');
          } else if (allFaces.length > 1) {
            setDetection(null);
            setBoxColor('red');
            setStatusMsg('Only one face at a time');
          } else {
            // Exactly one face, get landmarks and descriptor
            const result = await faceapi
              .detectSingleFace(videoRef.current, options)
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!isActive) return;

            if (result) {
              setDetection(result);
              setBoxColor('green');
              setStatusMsg('Face detected! Saving...');

              // Stop scanning and save instantly
              isActive = false;
              setStep('saving');
              saveDescriptor(result.descriptor).catch((e) => console.error(e));
              return; // Exit loop completely
            }
          }
        } catch (err) {
          console.error('[FaceDetect] Error:', err);
          if (isActive) setStatusMsg('Detection error, retrying...');
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
  }, [isReady, modelsLoaded, step]);

  async function saveDescriptor(descriptor) {
    if (!selectedMember) return;
    try {
      const descriptorArray = Array.from(descriptor);
      const collectionName = activeTab === 'member' ? 'members' : 'staff';
      const docRef = doc(db, collectionName, selectedMember.id);

      await updateDoc(docRef, {
        faceDescriptor: descriptorArray,
        faceRegistered: true,
        faceRegisteredAt: new Date().toISOString(),
      });

      // Update local data list too
      if (activeTab === 'member') {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === selectedMember.id
              ? { ...m, faceDescriptor: descriptorArray, faceRegistered: true }
              : m
          )
        );
      } else {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === selectedMember.id
              ? { ...s, faceDescriptor: descriptorArray, faceRegistered: true }
              : s
          )
        );
      }

      setStep('success');
      setBoxColor('green');
      setStatusMsg('Face ID Created Successfully!');
    } catch (err) {
      console.error('[SaveDescriptor] Error:', err);
      setPageError(`Failed to save face data: ${err.message}`);
      setStep('error');
    }
  }

  function handleMemberSelect(member) {
    setSelectedMember(member);
    setStep('camera');
    setStatusMsg('');
    setDetection(null);
    setBoxColor('red');
  }

  function handleStartDetection() {
    if (!modelsLoaded) {
      setStatusMsg('Models still loading...');
      return;
    }
    setStep('detecting');
  }

  function handleBack() {
    clearInterval(intervalRef.current);
    stopCamera();
    if (step === 'search') {
      navigate('/');
    } else if (step === 'camera' || step === 'detecting' || step === 'saving') {
      setStep('search');
      setSelectedMember(null);
      setDetection(null);
    } else {
      setStep('search');
      setSelectedMember(null);
      setDetection(null);
    }
  }

  function handleRetry() {
    setStep('camera');
    setDetection(null);
    setBoxColor('red');
    setStatusMsg('');
    setPageError(null);
  }

  // Show loading if models are loading
  if (!modelsLoaded && !modelError) {
    return <LoadingScreen icon="🤖" message={loadingProgress} />;
  }

  if (modelError) {
    return <LoadingScreen error={modelError} />;
  }

  return (
    <div className="nmf-page">
      {/* Header */}
      <header className="nmf-header">
        <button id="btn-nmf-back" className="header-back-btn" onClick={handleBack}>
          ← Back
        </button>
        <h1 className="nmf-title">
          {step === 'search' ? 'Select Member' : 'Register Face'}
        </h1>
        <div className="nmf-model-badge">
          {modelsLoaded ? '✓ AI Ready' : '⏳ Loading'}
        </div>
      </header>

      {/* Search Step */}
      {step === 'search' && (
        <div className="nmf-search-container">
          {dataError ? (
            <div className="nmf-error-box">{dataError}</div>
          ) : (
            <>
              <div className="nmf-tab-group">
                <button
                  className={`nmf-tab-btn ${activeTab === 'member' ? 'active' : ''}`}
                  onClick={() => setActiveTab('member')}
                >
                  Member Face
                </button>
                <button
                  className={`nmf-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
                  onClick={() => setActiveTab('staff')}
                >
                  Staff Face
                </button>
              </div>
              <p className="nmf-search-hint">
                Search for a {activeTab} to register their face ID
              </p>
              <MemberSearch
                members={activeTab === 'member' ? members : staffList}
                loading={dataLoading}
                onSelect={handleMemberSelect}
              />
            </>
          )}
        </div>
      )}

      {/* Camera / Detection / Saving / Success Steps */}
      {(step === 'camera' || step === 'detecting' || step === 'saving' || step === 'success') && (
        <div className="nmf-camera-container" ref={videoContainerRef}>
          {/* Video */}
          <video
            ref={videoRef}
            className="nmf-video"
            autoPlay
            playsInline
            muted
          />

          {/* Face box canvas */}
          {detection && (
            <FaceBox
              detection={detection}
              color={boxColor}
              videoElement={videoRef.current}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}

          {/* Camera error */}
          {cameraError && (
            <div className="camera-error-overlay">
              <div className="camera-error-content">
                <span className="camera-error-icon">📵</span>
                <p>{cameraError}</p>
              </div>
            </div>
          )}

          {/* Loading overlay before camera ready */}
          {!isReady && !cameraError && (
            <div className="camera-loading-overlay">
              <div className="spinner-ring" />
              <span>Starting camera...</span>
            </div>
          )}

          {/* Start Detect button (shown when camera is ready but not yet detecting) */}
          {step === 'camera' && isReady && !cameraError && (
            <div className="nmf-start-detect-overlay">
              <div className="nmf-selected-member-chip">
                <span className="chip-avatar">{(selectedMember.name || '?')[0]}</span>
                <span className="chip-name">{selectedMember.name}</span>
                <span className="chip-code">#{selectedMember.member_code || selectedMember.staff_code}</span>
              </div>
              <p className="nmf-detect-hint">Camera is ready. Position face in frame, then tap Detect.</p>
              <button
                id="btn-start-detect"
                className="nmf-detect-btn"
                onClick={handleStartDetection}
              >
                📸 Detect Face
              </button>
            </div>
          )}

          {/* Status bar during detection */}
          {(step === 'detecting' || step === 'saving') && (
            <div className="nmf-status-bar">
              <div className="nmf-scan-line" />
              <span className="nmf-status-msg">{statusMsg}</span>
            </div>
          )}

          {/* Success overlay */}
          {step === 'success' && (
            <div className="nmf-success-overlay">
              <div className="success-card">
                <div className="success-icon-ring">
                  <span className="success-icon">✓</span>
                </div>
                <h2 className="success-title">Face ID Created</h2>
                <div className="success-member-info">
                  <div className="success-name">{selectedMember.name}</div>
                  <div className="success-details">
                    <div className="success-detail">
                      <span className="detail-lbl">{activeTab === 'member' ? 'Member Code' : 'Staff Code'}</span>
                      <span className="detail-val">{selectedMember.member_code || selectedMember.staff_code || '—'}</span>
                    </div>
                    <div className="success-detail">
                      <span className="detail-lbl">Biometric ID</span>
                      <span className="detail-val">{selectedMember.biometric_id || '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="success-actions">
                  <button
                    id="btn-register-another"
                    className="success-btn-secondary"
                    onClick={() => {
                      stopCamera();
                      setStep('search');
                      setSelectedMember(null);
                      setDetection(null);
                    }}
                  >
                    Register Another
                  </button>
                  <button
                    id="btn-go-home"
                    className="success-btn-primary"
                    onClick={() => navigate('/')}
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="nmf-error-page">
          <div className="nmf-error-content">
            <span className="error-big-icon">⚠️</span>
            <h2>Save Failed</h2>
            <p>{pageError}</p>
            <div className="error-actions">
              <button className="btn-retry" onClick={handleRetry}>Try Again</button>
              <button className="btn-home" onClick={() => navigate('/')}>Go Home</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
