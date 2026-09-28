import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ASSETS } from '../config/assets';
import { useAppStore } from '../store/AppContext';

export function WorkspaceTransition({ ready, error = false, onRetry, onLogout, onComplete }: {
  ready: boolean; error?: boolean; onRetry?: () => void; onLogout?: () => void; onComplete: () => void;
}) {
  const [progress, setProgress] = useState(8);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => {
    const minimum = window.setTimeout(() => setMinimumElapsed(true), 3200);
    const advance = window.setInterval(() => setProgress(value => value >= 100 ? 100 : Math.min(90, value + (90 - value) * 0.12)), 350);
    return () => { clearTimeout(minimum); clearInterval(advance); };
  }, []);

  useEffect(() => {
    if (!ready || !minimumElapsed || error) return;
    setProgress(100);
    // Allow the bar to finish (600ms), hold briefly, then fade the screen out.
    const fade = window.setTimeout(() => setLeaving(true), 1000);
    const finish = window.setTimeout(() => complete.current(), 1400);
    return () => { clearTimeout(fade); clearTimeout(finish); };
  }, [ready, minimumElapsed, error]);

  const play = () => {
    if (!video.current) return;
    video.current.muted = true;
    void video.current.play().then(() => setVideoFailed(false)).catch(() => setVideoFailed(true));
  };

  return (
    <main className={`workspace-transition${leaving ? ' is-leaving' : ''}`} aria-labelledby="workspace-title">
      <section className="workspace-card">
        <div className="workspace-film">
          <video ref={video} autoPlay muted playsInline loop preload="auto" controls={false}
            disablePictureInPicture disableRemotePlayback aria-label="Pingüino JIP caminando"
            onCanPlay={play} onError={() => setVideoFailed(true)}>
            <source src={`${import.meta.env.BASE_URL}media/pinguino-caminando-alpha.webm`} type="video/webm" />
            <source src={`${import.meta.env.BASE_URL}media/pinguino-caminando.mp4`} type="video/mp4" />
          </video>
          {videoFailed && <button className="workspace-video-retry" onClick={play}>Reproducir video</button>}
        </div>
        <div className="workspace-brand"><img src={ASSETS.logo} alt="JIP" /></div>
        <div className="workspace-copy">
          <p className="workspace-eyebrow">PREPARANDO TU PANEL</p>
          <h1 id="workspace-title">Estamos cargando tu<br />espacio de trabajo</h1>
          <p className="workspace-description">Validando permisos, datos del inventario<br className="workspace-break" /> y accesos del sistema.</p>
        </div>
        <div className="workspace-progress-wrap">
          <div className="workspace-progress" role="progressbar" aria-label="Preparando tu espacio de trabajo"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
            aria-valuetext={error ? 'Carga interrumpida' : progress === 100 ? 'Panel listo' : 'Carga en curso'}>
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <p className="workspace-status" role="status">{error ? 'No pudimos cargar los datos. Inténtalo nuevamente.' : progress === 100 ? 'Todo listo. Bienvenido a JIP.' : 'Preparando tu espacio de trabajo…'}</p>
          {error && <div className="workspace-actions"><button onClick={onRetry}>Reintentar</button><button onClick={onLogout}>Volver al acceso</button></div>}
        </div>
      </section>
    </main>
  );
}

export default function WorkspaceGate({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const { initialLoad, retryInitialLoad } = useAppStore();
  const [complete, setComplete] = useState(false);
  if (complete) return children;
  return <WorkspaceTransition ready={initialLoad === 'ready'} error={initialLoad === 'error'}
    onRetry={retryInitialLoad} onLogout={onLogout} onComplete={() => setComplete(true)} />;
}

