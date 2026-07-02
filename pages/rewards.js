import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Ring, ProgressBar, Spinner, launchConfetti, toast, sounds, api } from '../components/UI';

export default function Rewards() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const [rewards, setRewards] = useState([]);
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([api('/api/rewards'), api('/api/tasks')]).then(([r, t]) => {
        setRewards(Array.isArray(r) ? r : []);
        setTasks(Array.isArray(t) ? t : []);
        setLoading(false);
      });
    }
  }, [status]);

  const done    = tasks.filter(t => t.status === 'done').length;
  const total   = tasks.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const weekly  = rewards.filter(r => r.reward_type === 'weekly');
  const trip    = rewards.find(r => r.reward_type === 'monthly');

  function celebrate(r) {
    if (pct >= 100 || r.status === 'unlocked') {
      launchConfetti();
      sounds.unlock();
      toast.success(r.name + ' — Let\'s go team! 🎉', '🎉');
    } else {
      toast.info('Complete all tasks this week to unlock!', '🔒');
    }
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
          <Spinner size={28} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="fade-up">
        <Card style={{ background: 'rgba(255,214,10,.04)', borderColor: 'rgba(255,214,10,.15)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--yellow)', marginBottom: 6 }}>Weekly Reward Status</div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, marginBottom: 4 }}>Team completion: {pct}%</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted2)' }}>
                {done} of {total} tasks done · {pct >= 100 ? '🎉 Unlock your reward!' : 'Keep going!'}
              </div>
            </div>
            <Ring value={pct} max={100} size={90} color="var(--yellow)" label={pct + '%'} sublabel="done" />
          </div>
          <ProgressBar value={pct} color="var(--yellow)" style={{ marginTop: 14 }} />
        </Card>

        {trip && (
          <Card style={{ background: 'linear-gradient(135deg,rgba(124,92,252,.12),rgba(0,212,255,.07))', borderColor: 'rgba(124,92,252,.25)', marginBottom: 20 }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--purple2)', marginBottom: 8 }}>Monthly Trip Challenge ✈️</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '2.5rem' }}>{trip.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>{trip.name}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted2)', marginBottom: 10 }}>{trip.description}</div>
                <ProgressBar value={done * 50} max={trip.coin_cost || 13000} color="var(--grad2)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--muted2)', marginTop: 5 }}>
                  <span>🪙 {Math.min(done * 50, trip.coin_cost || 13000).toLocaleString()}</span>
                  <span>Goal: 🪙{(trip.coin_cost || 13000).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>This Week&apos;s Options</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
          {weekly.map(r => {
            const unlocked = pct >= 100 || r.status === 'unlocked';
            return (
              <div
                key={r.id}
                onClick={() => celebrate(r)}
                style={{ background: unlocked ? 'rgba(0,229,160,.06)' : 'var(--surface2)', border: '1px solid ' + (unlocked ? 'rgba(0,229,160,.3)' : 'var(--border)'), borderRadius: 'var(--r)', padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all .2s', position: 'relative', opacity: unlocked ? 1 : .65 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: '.8rem' }}>{unlocked ? '🔓' : '🔒'}</div>
                <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{r.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 8 }}>{r.description}</div>
                <div style={{ fontSize: '.72rem', fontWeight: 600, color: unlocked ? 'var(--green)' : 'var(--muted2)' }}>
                  {unlocked ? '🎉 Tap to celebrate!' : 'Complete all tasks'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
