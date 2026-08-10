import { useCallback, useEffect, useRef, useState } from 'react';
import { stories as storiesAPI } from '../../services/api';
import { compressImage, trimAudio } from '../../utils/audio';
import { showToast } from '../Common/Toast';

interface StoryCreatorProps {
  onClose: () => void;
  onPublished: () => void;
}

const EXTRACT_OPTIONS = [
  { label: '5s', value: 5 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
];

export default function StoryCreator({ onClose, onPublished }: StoryCreatorProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioStartTime, setAudioStartTime] = useState(0);
  const [extractDuration, setExtractDuration] = useState(15);
  const [playingPreview, setPlayingPreview] = useState(false);
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPlayingPreview(false);
  }, []);

  useEffect(() => {
    return stopPreview;
  }, [stopPreview]);

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image trop volumineuse (max 10 Mo).', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target) setPreview(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAudio = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Musique trop volumineuse (max 5 Mo).', 'error');
      return;
    }
    if (!file.type.startsWith('audio/')) {
      showToast('Veuillez sélectionner un fichier audio.', 'error');
      return;
    }
    stopPreview();
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target) return;
      const data = e.target.result as string;
      setAudioData(data);
      setAudioName(file.name.replace(/\.[^/.]+$/, ''));
      setAudioStartTime(0);
      const tmp = new Audio(data);
      tmp.addEventListener(
        'loadedmetadata',
        () => {
          setAudioDuration(tmp.duration);
        },
        { once: true },
      );
    };
    reader.readAsDataURL(file);
  };

  const playExtract = () => {
    if (!audioData) return;
    stopPreview();
    const originalStart = audioStartTime;
    const audio = new Audio(audioData);
    audio.currentTime = originalStart;
    audio.volume = 0.5;
    previewAudioRef.current = audio;
    audio
      .play()
      .then(() => {
        setPlayingPreview(true);
        const interval = setInterval(() => {
          if (!previewAudioRef.current || previewAudioRef.current.paused) {
            clearInterval(interval);
            return;
          }
          setAudioStartTime(previewAudioRef.current.currentTime);
        }, 100);
        previewTimerRef.current = setTimeout(() => {
          clearInterval(interval);
          audio.pause();
          setPlayingPreview(false);
          setAudioStartTime(originalStart + extractDuration);
        }, extractDuration * 1000);
      })
      .catch((e) => {
        console.error(e);
      });
  };

  const publish = async () => {
    if (!preview || publishing) return;
    setPublishing(true);
    try {
      const compressedImg = await compressImage(preview);
      let trimmedData = audioData;
      if (audioData) {
        try {
          trimmedData = await trimAudio(audioData, audioStartTime, extractDuration);
        } catch (e) {
          console.error(e);
        }
      }
      await storiesAPI.create(
        compressedImg,
        'image',
        trimmedData || undefined,
        audioName || undefined,
        0,
        extractDuration,
        description || undefined,
      );
      showToast('Story publiée !', 'success');
      onPublished();
      onClose();
    } catch (_e) {
      showToast('Erreur lors de la publication.', 'error');
    }
    setPublishing(false);
  };

  const removeAudio = () => {
    stopPreview();
    setAudioData(null);
    setAudioName(null);
    setAudioDuration(0);
    setAudioStartTime(0);
  };

  const seekMax = Math.max(0, audioDuration - extractDuration);
  const canPreview = audioData && audioDuration > 0;

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box max-w-[440px] text-center">
        <h3>Ajouter une story</h3>
        <p className="modal-subtitle">Photo éphémère visible 12h</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleAudio(e.target.files[0]);
          }}
        />

        {!preview ? (
          <div
            className="p-10 cursor-pointer bg-[var(--bg-input)] rounded-xl mb-4 border-2 border-dashed border-[var(--border)]"
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Ajouter une image"
          >
            <div className="text-5xl mb-2">📷</div>
            <div className="text-text-muted">Cliquez pour sélectionner une image</div>
          </div>
        ) : (
          <div className="mb-4">
            <img
              src={preview}
              alt=""
              className="max-w-full max-h-[300px] rounded-xl object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {preview && (
          <>
            <textarea
              className="story-desc-input"
              placeholder="Ajouter une description..."
              maxLength={200}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="story-music-section">
              <div className="story-music-label">Musique de fond</div>
              {audioData ? (
                <div className="story-audio-attached">
                  <div className="story-music-attached">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <span className="story-music-filename">{audioName}</span>
                    <button className="story-music-remove" onClick={removeAudio} title="Retirer la musique">
                      ✕
                    </button>
                  </div>
                  {audioDuration > 0 && (
                    <div className="story-audio-trimmer">
                      <div className="trimmer-label">
                        Extrait — début à {Math.floor(audioStartTime / 60)}:
                        {(audioStartTime % 60).toString().padStart(2, '0')}
                      </div>
                      <input
                        type="range"
                        className="trimmer-slider"
                        min="0"
                        max={seekMax}
                        step="0.5"
                        value={audioStartTime}
                        onChange={(e) => setAudioStartTime(parseFloat(e.target.value))}
                      />
                      <div className="trimmer-info">
                        <span>
                          Début: {Math.floor(audioStartTime / 60)}:{(audioStartTime % 60).toString().padStart(2, '0')}
                        </span>
                        <span>
                          Fin: {Math.floor((audioStartTime + extractDuration) / 60)}:
                          {((audioStartTime + extractDuration) % 60).toString().padStart(2, '0')}
                        </span>
                        <span>
                          Total: {Math.floor(audioDuration / 60)}:
                          {Math.floor(audioDuration % 60)
                            .toString()
                            .padStart(2, '0')}
                        </span>
                      </div>
                      <div className="trimmer-duration-options">
                        {EXTRACT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            className={`trimmer-duration-btn${extractDuration === opt.value ? ' active' : ''}`}
                            onClick={() => {
                              setExtractDuration(opt.value);
                              setAudioStartTime((prev) => Math.min(prev, Math.max(0, audioDuration - opt.value)));
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn-secondary trimmer-preview-btn"
                        onClick={playingPreview ? stopPreview : playExtract}
                        disabled={!canPreview}
                      >
                        {playingPreview ? '⏹ Arrêter' : '▶️ Prévisualiser'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button className="btn-secondary story-music-add" onClick={() => audioRef.current?.click()}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  Ajouter une musique
                </button>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          {preview && (
            <>
              <button
                className="bg-transparent text-text-primary px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans"
                onClick={() => {
                  setPreview(null);
                  removeAudio();
                }}
              >
                Annuler
              </button>
              <button
                className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={publish}
                disabled={publishing}
              >
                {publishing ? 'Publication...' : 'Publier'}
              </button>
            </>
          )}
          {!preview && (
            <button
              className="bg-transparent text-text-primary px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans w-full"
              onClick={onClose}
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
