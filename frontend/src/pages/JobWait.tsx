import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchJob, retryJob } from '../api';
import { useToast } from '../toast';
import type { Job } from '../types';
import { errorMessage, estimateProgress, progressLabel } from '../utils';

export default function JobWait() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [percent, setPercent] = useState(1);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer: number;

    async function poll() {
      try {
        const next = await fetchJob(jobId as string);
        if (cancelled) return;
        setJob(next);
        setError('');
        if (next.invoiceId && (next.status === 'needs_review' || next.status === 'ready')) {
          window.clearInterval(timer);
          toast.success(
            next.status === 'needs_review' ? 'Extracted - needs review' : 'Extracted and ready',
          );
          navigate(`/invoices/${next.invoiceId}`, { replace: true });
          return;
        }
        if (next.status === 'failed') {
          window.clearInterval(timer);
          console.error('[job] failed', next.error_code, next.error_message);
          toast.error(next.error_message || 'Extraction failed');
        }
      } catch (err) {
        console.error('[job] poll failed', err);
        if (!cancelled) {
          const message = errorMessage(err);
          setError(message);
          toast.error(message);
        }
      }
    }

    poll();
    timer = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [attempt, jobId, navigate, toast]);

  useEffect(() => {
    if (job?.status === 'failed') return undefined;
    const started = Date.now();
    setPercent(1);
    const tick = window.setInterval(() => {
      setPercent(estimateProgress(job?.status, Date.now() - started));
    }, 120);
    return () => window.clearInterval(tick);
  }, [attempt, job?.status]);

  async function onRetry() {
    if (!jobId) return;
    try {
      await retryJob(jobId);
      toast.info('Retrying extraction…');
      setJob((current) =>
        current ? { ...current, status: 'queued', error_message: null } : current,
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
