/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
* @license Licensed under the GNU Affero General Public License v3.0
 * 
 * Copyright (C) 2025 German Zelaya
 * 
 * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 * 
 * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 * 
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import ConfModule from './conf.js';
import UiModule from './ui.js';
import I18n from './i18n.js';
import UtilsModule from './utils.js';

/**
 * Base64-encoded audio signal for playback during recording events.
 * @type {string}
 */
const audioSignal = `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`;
/**
 * Speech recognition instance.
 * @type {SpeechRecognition|webkitSpeechRecognition}
 */
let recognizer;
/** @type {boolean} Indicates if recording is active */
let isRecording = false;
/** @type {MediaRecorder} MediaRecorder instance for audio capture */
let mediaRecorder;
/** @type {Blob[]} Collected audio data chunks */
let audioChunks = [];
/** @type {number|null} Timeout ID for auto-stop */
let stopTimeout;
/** @type {boolean} Indicates if stop was manual */
let isManualStop = false;
/** @type {HTMLElement|null} Current reference element for voice button */
let currentReferenceElement;
/** @type {Map<HTMLElement, Function>} Maps reference elements to callbacks */
const callbackMap = new Map();
/** @type {number} Maximum recording duration in seconds */
let maxRecordingSeconds = ConfModule.get('audio.max_recording_seconds', 10);
/** @type {number|null} Timer interval ID */
let timerInterval = null;
/** @type {HTMLElement|null} Timer DOM element */
let timerElement = null;
/** @type {number} Full dash array length for timer SVG */
const FULL_DASH_ARRAY = 283;

/**
 * Handles errors and cleans up UI.
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {null}
 */
const handleError = (error, context) => {
  console.error(`❌ Error in ${context}:`, error);
  cleanupUI();
  return null;
};

/**
 * Calculates SHA-1 hash of input text.
 * @param {string} text - Text to hash
 * @returns {Promise<string>} SHA-1 hash
 */
const calculateSHA1 = async (text) => {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Resets UI elements to default state.
 */
const cleanupUI = () => {
  document.querySelectorAll('.community-thread, .interaction-item').forEach(el => {
    el.style.pointerEvents = '';
    el.style.opacity = '';
  });
  document.querySelectorAll('.voice-button').forEach(button => button.classList.remove('recording'));
  removeTimer();
};

/**
 * Removes the recording timer from the DOM and clears interval.
 */
const removeTimer = () => {
  if (timerElement) {
    timerElement.remove();
    timerElement = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

/**
 * Creates and displays a countdown timer for recording.
 */
const createTimer = () => {
  removeTimer();

  timerElement = document.createElement('div');
  timerElement.className = 'quelora_base-timer';
  timerElement.innerHTML = `
    <svg class="quelora_base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g class="quelora_base-timer__circle">
        <circle class="quelora_base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
        <path
          class="quelora_base-timer__path-remaining green"
          d="M 50, 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"
        ></path>
      </g>
    </svg>
    <span class="quelora_base-timer__label">${formatTime(maxRecordingSeconds)}</span>
  `;

  document.body.appendChild(timerElement);

  let timeLeft = maxRecordingSeconds;
  const warningThreshold = maxRecordingSeconds * 0.3;
  const alertThreshold = maxRecordingSeconds * 0.1;

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerElement.querySelector('.quelora_base-timer__label').textContent = formatTime(timeLeft);

    const pathRemaining = timerElement.querySelector('.quelora_base-timer__path-remaining');
    if (timeLeft <= alertThreshold) {
      pathRemaining.classList.remove('green', 'orange');
      pathRemaining.classList.add('red');
    } else if (timeLeft <= warningThreshold) {
      pathRemaining.classList.remove('green');
      pathRemaining.classList.add('orange');
    }

    const rawTimeFraction = timeLeft / maxRecordingSeconds;
    const adjustedFraction = 1 - (rawTimeFraction - (1 / maxRecordingSeconds) * (1 - rawTimeFraction));
    const circleDasharray = `${(adjustedFraction * FULL_DASH_ARRAY).toFixed(0)} ${FULL_DASH_ARRAY}`;
    pathRemaining.setAttribute('stroke-dasharray', circleDasharray);

    if (timeLeft <= 0) clearInterval(timerInterval);
  }, 1000);
};

/**
 * Formats time in seconds to MM:SS format.
 * @param {number} time - Time in seconds
 * @returns {string} Formatted time string
 */
const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

/**
 * Checks microphone permission status.
 * @returns {Promise<boolean|null>} True if granted, false if denied, null if prompt
 */
const checkMicrophonePermission = async () => {
  try {
    const { state } = await navigator.permissions.query({ name: "microphone" });
    return state === "granted" ? true : state === "denied" ? false : null;
  } catch (error) {
    return handleError(error, 'checkMicrophonePermission');
  }
};

/**
 * Plays an audio signal a specified number of times.
 * @param {number} [times=1] - Number of times to play (1-4)
 */
const playAudioSignal = async (times = 1) => {
  try {
    times = Math.max(1, Math.min(4, times));
    const audio = new Audio(`data:audio/mp3;base64,${audioSignal}`);
    let count = 0;

    const playOnce = () => {
      audio.currentTime = 0;
      audio.play().catch(e => console.error("Error playing audio signal:", e));
      count++;
      if (count < times) UtilsModule.startTimeout(playOnce, 500);
    };
    playOnce();
  } catch (e) {
    console.error("Error playing audio signal:", e);
  }
};

/**
 * Initiates audio recording and speech recognition.
 * @param {HTMLElement} referenceElement - Element associated with the voice button
 */
const audioSignaling = async (referenceElement) => {
  //console.log('audioSignaling: Starting, referenceElement:', referenceElement);
  try {
    if (isRecording || !(await checkMicrophonePermission())) {
      //console.log('audioSignaling: Exit early - isRecording:', isRecording, 'Permission:', await checkMicrophonePermission());
      return;
    }
    currentReferenceElement = referenceElement;
    //console.log('audioSignaling: Set currentReferenceElement');

    document.querySelectorAll('.community-thread, .interaction-item').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.5';
    });
    //console.log('audioSignaling: Disabled UI elements');

    recognizer = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en'; // Test with English
    recognizer.maxAlternatives = 1;
    //console.log('audioSignaling: Recognizer initialized, lang:', recognizer.lang);

    let partialTranscript = '';

    recognizer.onresult = async (event) => {
      //console.log('recognizer.onresult: Event received, results:', event.results);
      partialTranscript = Array.from(event.results).map(result => result[0].transcript).join('');
      //console.log('recognizer.onresult: Partial transcript:', partialTranscript);
      if (event.results[0].isFinal) {
        //console.log('recognizer.onresult: Final result detected');
        const audioBase64 = await finalizeAudio();
        //console.log('recognizer.onresult: Audio finalized, base64 length:', audioBase64?.length || 0);
        const callback = callbackMap.get(referenceElement);
        //console.log('recognizer.onresult: Callback exists:', !!callback);
        if (typeof callback === 'function') {
          const hash = await calculateSHA1((audioBase64 || '') + (partialTranscript || ''));
          callback(partialTranscript || null, audioBase64, hash);
        }
        audioChunks = [];
        await stopRecording();
      }
    };

    recognizer.onerror = async (event) => {
      //console.log('recognizer.onerror: Error:', event.error, 'message:', event.message);
      if (event.error === 'no-speech' && recognizer.retryCount < 2) {
        recognizer.retryCount = (recognizer.retryCount || 0) + 1;
        //console.log('recognizer.onerror: Retrying, attempt:', recognizer.retryCount);
        try {
          recognizer.start();
        } catch (e) {
          //console.log('recognizer.onerror: Retry failed:', e);
          await handleErrorStop(partialTranscript, referenceElement);
        }
      } else {
        //console.log('recognizer.onerror: Rendering error UI');
        UiModule.renderErrorMessageUI(I18n.getTranslation('speechRecognitionError'));
        await handleErrorStop(partialTranscript, referenceElement);
      }
    };

    recognizer.onend = async () => {
      //console.log('recognizer.onend: Recognition ended, isRecording:', isRecording, 'partialTranscript:', partialTranscript, 'retryCount:', recognizer.retryCount || 0);
      if (isRecording && !partialTranscript && recognizer.retryCount < 2) {
        recognizer.retryCount = (recognizer.retryCount || 0) + 1;
        //console.log('recognizer.onend: Retrying, attempt:', recognizer.retryCount);
        try {
          recognizer.start();
        } catch (e) {
          //console.log('recognizer.onend: Retry failed:', e);
          await handleErrorStop(partialTranscript, referenceElement);
        }
      } else {
        //console.log('recognizer.onend: No retry, invoking callback');
        await handleErrorStop(partialTranscript, referenceElement); // Ensure callback on end
      }
    };

    //console.log('audioSignaling: Starting recognizer');
    recognizer.start();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //console.log('audioSignaling: Media stream acquired');
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: ConfModule.get('audio.bitrate', 16000) });
    mediaRecorder.ondataavailable = e => e.data.size > 0 && audioChunks.push(e.data);
    mediaRecorder.start(100);
    //console.log('audioSignaling: MediaRecorder started');

    createTimer();

    const handleAutoStopRecording = async () => {
      if (!isRecording) return;
      isManualStop = false;
      //console.log('audioSignaling: Auto-stop triggered');
      await handleErrorStop(partialTranscript, referenceElement); // Ensure callback on auto-stop
      await stopRecording();
      await playAudioSignal(2);
    };

    stopTimeout = UtilsModule.startTimeout(handleAutoStopRecording, 30000); // 30 seconds
    //console.log('audioSignaling: Auto-stop timeout set to 30s');

    isRecording = true;
    new Audio(`data:audio/mp3;base64,${audioSignal}`).play().catch(e => console.error("Error playing sound:", e));
    document.querySelectorAll('.voice-button').forEach(button => button.classList.add('recording'));
    //console.log('audioSignaling: Recording started, UI updated');
  } catch (error) {
    //console.log('audioSignaling: Error caught:', error);
    handleError(error, 'audioSignaling');
    UiModule.renderErrorMessageUI(I18n.getTranslation('speechRecognitionError'));
    await handleErrorStop('', referenceElement); // Ensure callback on error
    stopRecording();
  }
};

/**
 * Handles stopping recording on error and invokes callback.
 * @param {string} partialTranscript - Partial speech recognition result
 * @param {HTMLElement} referenceElement - Associated reference element
 */
const handleErrorStop = async (partialTranscript, referenceElement) => {
  await stopRecording();
  const audioBase64 = await finalizeAudio();
  const callback = callbackMap.get(referenceElement);
  if (typeof callback === 'function') {
    const hash = await calculateSHA1((audioBase64 || '') + (partialTranscript || ''));
    callback(partialTranscript || null, audioBase64, hash);
  }
};

/**
 * Stops audio recording and speech recognition.
 */
const stopRecording = async () => {
  //console.log('stopRecording: Called, isRecording:', isRecording);
  if (!isRecording) return;
  isRecording = false;
  //console.log('stopRecording: Set isRecording to false');

  try {
    if (!isManualStop) {
      recognizer.onend = null;
      recognizer.onerror = null;
    }
    recognizer.stop();
  } catch (e) {
    console.warn("Recognizer stop failed:", e);
  }

  try {
    if (mediaRecorder?.state !== "inactive") {
      await new Promise(resolve => {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      });
    }
  } catch (e) {
    console.warn("MediaRecorder stop failed:", e);
  }

  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  //console.log('stopRecording: Cleanup UI');
  cleanupUI();
};

/**
 * Converts recorded audio chunks to Base64.
 * @returns {Promise<string|null>} Base64 audio data or null if no chunks
 */
const finalizeAudio = async () => {
  if (!audioChunks.length) return null;
  const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result?.split(',')[1] || null);
    reader.readAsDataURL(blob);
  });
};

/**
 * Adds a voice button next to a reference element.
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.iconReferenceElement - Element to place button after
 * @param {Function} options.onResult - Callback for recording results
 */
const addVoiceButton = ({ iconReferenceElement, onResult }) => {
  try {
    if (!iconReferenceElement || typeof onResult !== 'function') {
      throw new Error("iconReferenceElement and onResult callback are required.");
    }

    if (iconReferenceElement.nextElementSibling?.classList.contains('voice-button')) return;

    callbackMap.set(iconReferenceElement, onResult);

    if (!UtilsModule.isMobile) {
      const voiceButton = document.createElement('span');
      voiceButton.classList.add('quelora-icons-outlined', 'voice-button');
      voiceButton.textContent = 'keyboard_voice';

      const start = e => {
        e.preventDefault();
        audioSignaling(iconReferenceElement);
      };
      const stop = e => {
        e.preventDefault();
        isManualStop = true;
        stopRecording();
      };

      voiceButton.addEventListener('touchstart', start);
      voiceButton.addEventListener('touchend', stop);
      voiceButton.addEventListener('mousedown', start);
      voiceButton.addEventListener('mouseup', stop);
      voiceButton.addEventListener('mouseleave', e => {
        e.preventDefault();
        if (isRecording) stopRecording();
      });

      iconReferenceElement.insertAdjacentElement('afterend', voiceButton);
    }
  } catch (error) {
    handleError(error, 'addVoiceButton');
  }
};

/**
 * Module for handling audio recording and speech recognition.
 * @type {Object}
 */
const AudioRecorderModule = {
  addVoiceButton,
  stopRecording,
  playAudioSignal,
  isRecording: () => isRecording,
  /**
   * Sets maximum recording duration.
   * @param {number} seconds - Duration in seconds
   */
  setMaxRecordingSeconds: seconds => {
    if (typeof seconds === 'number' && seconds > 0) maxRecordingSeconds = seconds;
  }
};

export default AudioRecorderModule;