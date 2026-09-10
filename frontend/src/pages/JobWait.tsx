import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchJob, retryJob } from '../api';
import { useToast } from '../toast';
import type { Job } from '../types';
import { errorMessage, estimateProgress, progressLabel } from '../utils';

const POLL_MS = 1500;

function isTerminal(job: Job) {
  return (
    job.status === 'failed' ||
    (Boolean(job.invoiceId) && (job.status === 'needs_review' || job.status === 'ready'))
  );
}

export default function JobWait() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [percent, setPercent] = useState(1);

  useEffect(() => {
    if (!jobId) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    let consecutiveFailures = 0;

    async function poll() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const next = await fetchJob(jobId as string);
        if (cancelled) return;
        consecutiveFailures = 0;
        setJob((prev) => {
          if (
            prev &&
            prev.status === next.status &&
            prev.invoiceId === next.invoiceId &&
            prev.error_code === next.error_code &&
            prev.error_message === next.error_message
          ) {
            return prev;
          }
          return next;
        });
        setError('');

        if (next.invoiceId && (next.status === 'needs_review' || next.status === 'ready')) {
          if (timer !== undefined) window.clearInterval(timer);
          timer = undefined;
          toastRef.current.success(
            next.status === 'needs_review' ? 'Extracted - needs review' : 'Extracted and ready',
          );
          navigate(`/invoices/${next.invoiceId}`, { replace: true });
          return;
        }

        if (next.status === 'failed') {
          if (timer !== undefined) window.clearInterval(timer);
          timer = undefined;
          console.error('[job] failed', next.error_code, next.error_message);
        }
      } catch (err) {
        consecutiveFailures += 1;
        console.error('[job] poll failed', err);
        // Nodemon restarts / brief proxy blips show as 500/ECONNRESET — keep polling.
        if (!cancelled && consecutiveFailures >= 3) {
          const message = errorMessage(err);
          setError(message);
          toastRef.current.error(message);
        }
      } finally {
        inFlight = false;
      }
    }

    poll();
    timer = window.setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [attempt, jobId, navigate]);

  const jobStatus = job?.status;
  const jobDone = job ? isTerminal(job) : false;

  useEffect(() => {
    if (!jobStatus || jobDone) return undefined;
    const started = Date.now();
    setPercent(estimateProgress(jobStatus, 0));
    const tick = window.setInterval(() => {
      setPercent(estimateProgress(jobStatus, Date.now() - started));
    }, 120);
    return () => window.clearInterval(tick);
  }, [attempt, jobStatus, jobDone]);

  async function onRetry() {
    if (!jobId) return;
    try {
      await retryJob(jobId);
      toast.info('Retrying extraction…');
      setJob((current) =>
        current ? { ...current, status: 'queued', error_code: null, error_message: null } : current,
      );
      setAttempt((n) => n + 1);
    } catch (err) {
      console.error('[job] retry failed', err);
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    }
  }

  if (error && !job) {
    return <p className="banner error">{error}</p>;
  }

  if (job?.status === 'failed') {
    const title =
      job.error_code === 'MODEL_OVERLOADED'
        ? 'Gemini is busy'
        : job.error_code === 'RATE_LIMIT'
          ? 'Rate limited'
          : 'Extraction failed';
    return (
      <div className="empty empty-fail">
        <p className="eyebrow">Something went wrong</p>
        <h2>{title}</h2>
        <p>{job.error_message || 'Something went wrong.'}</p>
        {job.error_code ? <p className="muted">Code: {job.error_code}</p> : null}
        {error ? <p className="banner error">{error}</p> : null}
        <button type="button" className="primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="empty empty-wait">
      <h2>{progressLabel(percent)}</h2>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Extraction progress"
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="progress-pct">{percent}%</p>
      <p>This usually takes a few seconds. We will open the review screen when it is ready.</p>
    </div>
  );
}
