import { useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

const MODELS_PATH = '/models';

/**
 * Hook that loads face-api.js models from /public/models.
 * Returns { modelsLoaded, loadingProgress, error }.
 */
export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('Initializing...');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoaded(false);
      setError(null);

      try {
        setLoadingProgress('Loading face detector...');
        console.log('[faceApi] Loading tinyFaceDetector from', MODELS_PATH);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH);
        console.log('[faceApi] Successfully loaded tinyFaceDetector');
        if (cancelled) return;

        setLoadingProgress('Loading face landmarks...');
        console.log('[faceApi] Loading faceLandmark68Net from', MODELS_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH);
        console.log('[faceApi] Successfully loaded faceLandmark68Net');
        if (cancelled) return;

        setLoadingProgress('Loading face recognition...');
        console.log('[faceApi] Loading faceRecognitionNet from', MODELS_PATH);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH);
        console.log('[faceApi] Successfully loaded faceRecognitionNet');
        if (cancelled) return;

        setLoadingProgress('Models ready');
        console.log('[faceApi] All models successfully loaded!');
        setModelsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        console.error('[faceApi] Model load failed explicitly at runtime:', err);
        setError(
          'Failed to load face recognition models. ' +
          'Make sure model files are in /public/models/. ' +
          `Error: ${err.message}`
        );
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  return { modelsLoaded, loadingProgress, error };
}

export { faceapi };
