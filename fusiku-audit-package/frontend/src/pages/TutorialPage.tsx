import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, PlayCircle, Sparkles } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

function resolveTutorialVideoUrl(): string | null {
  const s = String(import.meta.env.VITE_TUTORIAL_VIDEO_URL ?? '').trim();
  return s || null;
}

export default function TutorialPage() {
  const { t } = useTranslation();
  usePageTitle('login.tutorialTitle');

  const videoUrl = useMemo(() => resolveTutorialVideoUrl(), []);

  return (
    <div className="tutorial-page">
      <header className="tutorial-header">
        <Link to="/login" className="tutorial-back">
          <ArrowLeft size={16} aria-hidden /> {t('common.back', { defaultValue: 'Back' })}
        </Link>
        <div className="tutorial-title">
          <Sparkles size={18} aria-hidden /> {t('login.tutorialTitle', { defaultValue: 'Video tutorial' })}
        </div>
      </header>

      <main className="tutorial-content">
        <div className="tutorial-card">
          <div className="tutorial-cardTitle">
            <PlayCircle size={18} aria-hidden /> {t('login.tutorialTitle', { defaultValue: 'Quick start (AI-assisted)' })}
          </div>

          {videoUrl ? (
            <div className="tutorial-videoWrap">
              <video className="tutorial-video" controls preload="metadata">
                <source src={videoUrl} />
              </video>
              <div className="tutorial-hint">
                {t('login.tutorialVideoHint', {
                  defaultValue:
                    'Tip: if the video does not load, set VITE_TUTORIAL_VIDEO_URL to a public .mp4 URL and restart the frontend.',
                })}
              </div>
            </div>
          ) : (
            <div className="tutorial-empty">
              <div className="tutorial-emptyTitle">
                {t('login.tutorialMissingVideoTitle', { defaultValue: 'Tutorial video not configured' })}
              </div>
              <div className="tutorial-emptyText">
                {t('login.tutorialMissingVideoText', {
                  defaultValue:
                    'Set VITE_TUTORIAL_VIDEO_URL in your frontend .env file to a public .mp4 URL, then restart the dev server.',
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

